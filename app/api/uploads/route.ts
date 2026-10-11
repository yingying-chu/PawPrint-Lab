import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { pets, petPhotos } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import {
  cleanupExpiredPhotos,
  deletionDate,
  privatePhotoKey,
  recordPetId as toRecordPetId,
  retentionDays,
} from "@/lib/photo-storage";

export const runtime = "edge";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable." }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  const petId = String(form.get("petId") ?? "").trim();
  const petName = String(form.get("petName") ?? "").trim();
  const petType = String(form.get("petType") ?? "Other").trim();
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return Response.json({ error: "Choose a valid image file." }, { status: 400 });
  }
  if (!petId || !petName) {
    return Response.json({ error: "Pet name and profile are required." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "Images must be 10 MB or smaller." }, { status: 413 });
  }

  await cleanupExpiredPhotos(user.userId);
  const db = getDb();
  const now = new Date().toISOString();
  const photoId = crypto.randomUUID();
  const deleteAfter = deletionDate();
  const recordPetId = toRecordPetId(user.userId, petId);
  const r2Key = privatePhotoKey(user.userId, recordPetId, photoId);

  await db.insert(pets).values({
    id: recordPetId,
    userId: user.userId,
    name: petName.slice(0, 80),
    type: petType.slice(0, 40),
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: pets.id,
    set: { name: petName.slice(0, 80), type: petType.slice(0, 40), updatedAt: now },
  });

  await env.BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { userId: user.userId, petId: recordPetId, deleteAfter: deleteAfter.toISOString() },
  });
  await db.insert(petPhotos).values({
    id: photoId,
    petId: recordPetId,
    userId: user.userId,
    r2Key,
    fileName: file.name.slice(0, 180),
    contentType: file.type,
    status: "stored",
    createdAt: now,
    deleteAfter: deleteAfter.toISOString(),
  });

  return Response.json({
    photo: { id: photoId, petId: recordPetId, fileName: file.name, status: "stored", deleteAfter: deleteAfter.toISOString() },
    retentionDays: retentionDays(),
  }, { status: 201 });
}
