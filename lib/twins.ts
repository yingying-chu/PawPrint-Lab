import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petPhotos, twinJobs } from "@/db/schema";
import {
  MeshyError,
  arrayBufferToDataUrl,
  copyAssetToBucket,
  createImageTo3DTask,
  getImageTo3DTask,
  meshyConfigured,
  taskErrorMessage,
} from "@/lib/meshy";
import { privateAssetKey } from "@/lib/photo-storage";

type TwinJob = typeof twinJobs.$inferSelect;

const SAVE_TIMEOUT_MS = 5 * 60 * 1000;

async function update(row: TwinJob, changes: Partial<TwinJob>): Promise<TwinJob> {
  const updated = { ...changes, updatedAt: new Date().toISOString() };
  await getDb().update(twinJobs).set(updated).where(eq(twinJobs.id, row.id));
  return { ...row, ...updated };
}

/** Sends the job's saved photo to Meshy image-to-3D. */
export async function submitTwinJob(row: TwinJob): Promise<TwinJob> {
  const [photo] = await getDb().select().from(petPhotos).where(eq(petPhotos.id, row.photoId)).limit(1);
  const object = photo ? await env.BUCKET?.get(photo.r2Key) : null;
  if (!photo || !object) return update(row, { status: "failed", error: "The saved photo has expired." });
  try {
    const task = await createImageTo3DTask(arrayBufferToDataUrl(await object.arrayBuffer(), photo.contentType));
    return update(row, { status: "submitted", providerTaskId: task.result, error: null });
  } catch (error) {
    if (error instanceof MeshyError && error.retryable) throw error;
    return update(row, { status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Meshy request failed" });
  }
}

/**
 * Advances a twin job by one step: submits jobs that were waiting for the key,
 * polls submitted ones, and copies a finished GLB into private storage before
 * Meshy's signed URL expires.
 */
export async function refreshTwinJob(row: TwinJob): Promise<{ job: TwinJob; progress: number }> {
  if (row.status === "waiting_for_provider_key" && meshyConfigured()) {
    return { job: await submitTwinJob(row), progress: 0 };
  }
  if (row.status === "saving") {
    // Another request is copying the model; reclaim it only if that copy stalled.
    const stalled = Date.now() - Date.parse(row.updatedAt) > SAVE_TIMEOUT_MS;
    if (!stalled) return { job: row, progress: 100 };
    row = await update(row, { status: "submitted" });
  }
  if (row.status !== "submitted" || !row.providerTaskId) {
    return { job: row, progress: row.status === "ready" ? 100 : 0 };
  }
  try {
    const task = await getImageTo3DTask(row.providerTaskId);
    if (task.status === "SUCCEEDED") {
      const glbUrl = task.model_urls?.glb;
      if (!glbUrl) return { job: await update(row, { status: "failed", error: "Meshy returned no GLB model." }), progress: 100 };
      // Claim the copy so overlapping polls don't each download the model.
      const claimed = await getDb().update(twinJobs)
        .set({ status: "saving", updatedAt: new Date().toISOString() })
        .where(and(eq(twinJobs.id, row.id), eq(twinJobs.status, "submitted")))
        .returning({ id: twinJobs.id });
      if (!claimed.length) return { job: { ...row, status: "saving" }, progress: 100 };
      const modelR2Key = privateAssetKey(row.userId, row.petId, "models", `${row.id}.glb`);
      try {
        await copyAssetToBucket(glbUrl, modelR2Key, "model/gltf-binary");
      } catch (error) {
        await update(row, { status: "submitted" });
        throw error;
      }
      return { job: await update(row, { status: "ready", modelR2Key, error: null }), progress: 100 };
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      return { job: await update(row, { status: "failed", error: taskErrorMessage(task, "Meshy could not build the 3D model.") }), progress: 0 };
    }
    return { job: row, progress: task.progress ?? 0 };
  } catch (error) {
    if (error instanceof MeshyError && error.retryable) return { job: row, progress: 0 };
    throw error;
  }
}

export function serializeTwinJob(job: TwinJob, progress: number) {
  return {
    id: job.id,
    status: job.status,
    progress,
    error: job.error,
    modelUrl: job.status === "ready" ? `/api/twin-jobs/${job.id}/model` : null,
    createdAt: job.createdAt,
  };
}
