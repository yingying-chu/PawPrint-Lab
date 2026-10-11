import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petPhotos, twinJobs } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { arrayBufferToDataUrl, createImageTo3DTask } from "@/lib/meshy";
import { cleanupExpiredPhotos } from "@/lib/photo-storage";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const body = await request.json().catch(() => ({})) as { petId?: string; photoId?: string };
  if (!body.photoId) {
    return Response.json({ error: "A saved pet photo is required." }, { status: 400 });
  }
  await cleanupExpiredPhotos(user.userId);
  const db = getDb();
  const [photo] = await db.select().from(petPhotos).where(and(
    eq(petPhotos.id, body.photoId),
    eq(petPhotos.userId, user.userId),
  )).limit(1);
  if (!photo) return Response.json({ error: "Saved photo not found or expired." }, { status: 404 });

  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  if (!env.MESHY_API_KEY) {
    await db.insert(twinJobs).values({
      id: jobId,
      petId: photo.petId,
      userId: user.userId,
      photoId: body.photoId,
      status: "waiting_for_provider_key",
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ job: { id: jobId, status: "waiting_for_provider_key" } }, { status: 202 });
  }
  if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable." }, { status: 503 });

  const object = await env.BUCKET.get(photo.r2Key);
  if (!object) return Response.json({ error: "Saved photo has expired." }, { status: 410 });
  try {
    const imageUrl = arrayBufferToDataUrl(await object.arrayBuffer(), photo.contentType);
    const task = await createImageTo3DTask(env.MESHY_API_KEY, imageUrl);
    const providerTaskId = String(task.result ?? task.id ?? "");
    await db.insert(twinJobs).values({
      id: jobId,
      petId: photo.petId,
      userId: user.userId,
      photoId: body.photoId,
      providerTaskId,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ job: { id: jobId, status: "submitted", providerTaskId } }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meshy request failed";
    await db.insert(twinJobs).values({
      id: jobId,
      petId: photo.petId,
      userId: user.userId,
      photoId: body.photoId,
      status: "failed",
      error: message.slice(0, 500),
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ error: message, job: { id: jobId, status: "failed" } }, { status: 502 });
  }
}
