import { env } from "cloudflare:workers";
import { and, eq, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { petPhotos } from "@/db/schema";

export const DEFAULT_RETENTION_DAYS = 30;

export function retentionDays() {
  const configured = Number(env.PHOTO_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(Math.round(configured), 365)
    : DEFAULT_RETENTION_DAYS;
}

export function deletionDate(from = new Date()) {
  return new Date(from.getTime() + retentionDays() * 24 * 60 * 60 * 1000);
}

export async function cleanupExpiredPhotos(userId?: string) {
  if (!env.BUCKET) throw new Error("R2 binding `BUCKET` is unavailable.");
  const db = getDb();
  const cutoff = new Date().toISOString();
  const where = userId
    ? and(eq(petPhotos.userId, userId), lte(petPhotos.deleteAfter, cutoff))
    : lte(petPhotos.deleteAfter, cutoff);
  const expired = await db.select().from(petPhotos).where(where).limit(100);

  if (!expired.length) return 0;
  await Promise.all(expired.map((photo) => env.BUCKET!.delete(photo.r2Key)));
  for (const photo of expired) {
    await db.delete(petPhotos).where(eq(petPhotos.id, photo.id));
  }
  return expired.length;
}

const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

/** Server pet id: the client's pet profile id, namespaced by user. */
export function recordPetId(userId: string, petKey: string) {
  return `${safe(userId)}--${petKey}`;
}

export function privatePhotoKey(userId: string, petId: string, photoId: string) {
  return `users/${safe(userId)}/pets/${safe(petId)}/photos/${photoId}`;
}

export function privateAssetKey(userId: string, petId: string, folder: "assets" | "models", file: string) {
  return `users/${safe(userId)}/pets/${safe(petId)}/${folder}/${file}`;
}
