import { env } from "@/lib/env";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petAssets } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { serializeCharacter } from "@/lib/characters";
import { privateAssetKey, recordPetId } from "@/lib/photo-storage";

const MAX_PNG_BYTES = 4 * 1024 * 1024;
const STITCH_LABELS: Record<string, string> = { running: "running stitch", chain: "chain stitch" };

/**
 * Saves embroidery lettering drawn in the browser (public/lettering.js) to the
 * pet's gallery. No provider is involved, so it is stored as already finished.
 */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!env.BUCKET) return Response.json({ error: "Storage is unavailable." }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  const petKey = String(form.get("petKey") ?? "").trim().slice(0, 80);
  const petName = String(form.get("petName") ?? "").trim().slice(0, 40);
  const text = String(form.get("text") ?? "").trim().slice(0, 40);
  const fontLabel = String(form.get("fontLabel") ?? "").trim().slice(0, 30);
  const stitch = STITCH_LABELS[String(form.get("stitch"))] ? String(form.get("stitch")) : "running";
  if (!(file instanceof File) || file.type !== "image/png") {
    return Response.json({ error: "Lettering must be a PNG." }, { status: 400 });
  }
  if (file.size > MAX_PNG_BYTES) return Response.json({ error: "Lettering image is too large." }, { status: 413 });
  if (!petKey || !petName || !text) return Response.json({ error: "Pet and lettering text are required." }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();
  const r2Key = privateAssetKey(user.userId, recordPetId(user.userId, petKey), "assets", id);
  await env.BUCKET.put(r2Key, file.stream(), { httpMetadata: { contentType: "image/png" } });

  const existing = await db.select({ id: petAssets.id }).from(petAssets)
    .where(and(eq(petAssets.userId, user.userId), eq(petAssets.petKey, petKey), eq(petAssets.kind, "lettering")));
  const now = new Date().toISOString();
  const row = {
    id,
    userId: user.userId,
    petKey,
    petName,
    kind: "lettering",
    name: `“${text}” lettering${existing.length ? ` ${existing.length + 1}` : ""}`,
    prompt: `${fontLabel || "Rounded"} · ${STITCH_LABELS[stitch]}`,
    style: stitch,
    photoId: null,
    sourceAssetId: null,
    provider: "studio",
    providerTaskType: "none",
    providerTaskId: "",
    status: "succeeded",
    r2Key,
    contentType: "image/png",
    arcadeReferenceId: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(petAssets).values(row);
  return Response.json({ character: serializeCharacter(row) }, { status: 201 });
}
