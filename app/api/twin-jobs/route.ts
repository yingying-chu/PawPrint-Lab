import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petPhotos, twinJobs } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { meshyConfigured } from "@/lib/meshy";
import { cleanupExpiredPhotos, recordPetId } from "@/lib/photo-storage";
import { refreshTwinJob, serializeTwinJob, submitTwinJob } from "@/lib/twins";

export const runtime = "edge";

/** Latest twin job for a pet profile, advanced by one poll. */
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const petKey = new URL(request.url).searchParams.get("petKey")?.trim();
  if (!petKey) return Response.json({ error: "petKey is required." }, { status: 400 });
  const [row] = await getDb().select().from(twinJobs)
    .where(and(eq(twinJobs.userId, user.userId), eq(twinJobs.petId, recordPetId(user.userId, petKey))))
    .orderBy(desc(twinJobs.createdAt))
    .limit(1);
  if (!row) return Response.json({ job: null, configured: meshyConfigured() });
  const { job, progress } = await refreshTwinJob(row).catch(() => ({ job: row, progress: 0 }));
  return Response.json({ job: serializeTwinJob(job, progress), configured: meshyConfigured() });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const body = await request.json().catch(() => ({})) as { photoId?: string };
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
  const row = {
    id: crypto.randomUUID(),
    petId: photo.petId,
    userId: user.userId,
    photoId: photo.id,
    provider: "meshy",
    providerTaskId: null,
    status: "waiting_for_provider_key",
    modelR2Key: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(twinJobs).values(row);
  // Without a key the job waits; it is submitted on the first poll after the key is added.
  if (!meshyConfigured()) return Response.json({ job: serializeTwinJob(row, 0) }, { status: 202 });
  try {
    const job = await submitTwinJob(row);
    const status = job.status === "failed" ? 502 : 202;
    return Response.json({ job: serializeTwinJob(job, 0), ...(job.error ? { error: job.error } : {}) }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meshy request failed";
    return Response.json({ error: message, job: serializeTwinJob(row, 0) }, { status: 503 });
  }
}
