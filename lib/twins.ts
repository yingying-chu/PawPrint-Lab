import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petPhotos, pets, twinJobs } from "@/db/schema";
import {
  MeshyError,
  arrayBufferToDataUrl,
  copyAssetToBucket,
  createImageTask,
  createImageTo3DTask,
  getImageTask,
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

// Image-to-3D turns photo-real fur into spiky geometry and keeps harnesses and
// leashes, so the photo is first redrawn as a clean, toy-like character.
function cuteTwinPrompt(petType: string) {
  const subject = petType && petType !== "Other" ? petType.toLowerCase() : "pet";
  return [
    `A cute stylized character of this exact ${subject} from the reference photo, sitting upright,`,
    "body angled slightly to the side, full body visible from ears to tail.",
    "Keep their real look: the same coat colors and markings, eye color and face shape.",
    "Make them adorable like a premium vinyl toy or soft plush: rounded chubby body, slightly larger head,",
    "big round gentle eyes with bright catchlights, a calm sweet expression,",
    "fur shaped into smooth soft rounded tufts instead of spiky strands, short tidy whiskers.",
    "Remove any harness, leash, collar, clothing, straps or accessories completely.",
    "Plain light neutral background, soft even studio lighting, no text.",
  ].join(" ");
}

/**
 * Step 1 of a twin: redraws the saved photo as a cute character with Meshy
 * image-to-image. refreshTwinJob starts image-to-3D from it once it's done.
 */
export async function submitTwinJob(row: TwinJob): Promise<TwinJob> {
  const db = getDb();
  const [photo] = await db.select().from(petPhotos).where(eq(petPhotos.id, row.photoId)).limit(1);
  const object = photo ? await env.BUCKET?.get(photo.r2Key) : null;
  if (!photo || !object) return update(row, { status: "failed", error: "The saved photo has expired." });
  const [pet] = await db.select({ type: pets.type }).from(pets).where(eq(pets.id, row.petId)).limit(1);
  try {
    const task = await createImageTask({
      prompt: cuteTwinPrompt(pet?.type ?? ""),
      referenceImageUrls: [arrayBufferToDataUrl(await object.arrayBuffer(), photo.contentType)],
      removeBackground: true,
      model: "nano-banana-pro",
    });
    return update(row, { status: "styling", providerTaskId: task.taskId, error: null });
  } catch (error) {
    if (error instanceof MeshyError && error.retryable) throw error;
    return update(row, { status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Meshy request failed" });
  }
}

/** Step 2: once the cute character image is done, build the 3D model from it. */
async function advanceStyling(row: TwinJob): Promise<{ job: TwinJob; progress: number }> {
  const task = await getImageTask("image-to-image", row.providerTaskId!);
  if (task.status === "FAILED" || task.status === "CANCELED") {
    return { job: await update(row, { status: "failed", error: taskErrorMessage(task, "Meshy could not draw the character.") }), progress: 0 };
  }
  if (task.status !== "SUCCEEDED") return { job: row, progress: task.progress ?? 0 };
  // Claim the hand-off so overlapping polls can't each start a paid 3D task.
  const claimed = await getDb().update(twinJobs)
    .set({ status: "starting_3d", updatedAt: new Date().toISOString() })
    .where(and(eq(twinJobs.id, row.id), eq(twinJobs.status, "styling")))
    .returning({ id: twinJobs.id });
  if (!claimed.length) return { job: { ...row, status: "starting_3d" }, progress: 0 };
  try {
    const model = await createImageTo3DTask({ inputTaskId: task.id });
    return { job: await update(row, { status: "submitted", providerTaskId: model.result, error: null }), progress: 0 };
  } catch (error) {
    if (error instanceof MeshyError && error.retryable) {
      await update(row, { status: "styling" });
      throw error;
    }
    return { job: await update(row, { status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Meshy request failed" }), progress: 0 };
  }
}

/**
 * Advances a twin job by one step: submits jobs that were waiting for the key,
 * moves a finished character image on to 3D, polls the 3D task, and copies a finished GLB into private storage before
 * Meshy's signed URL expires.
 */
export async function refreshTwinJob(row: TwinJob): Promise<{ job: TwinJob; progress: number }> {
  if (row.status === "waiting_for_provider_key" && meshyConfigured()) {
    return { job: await submitTwinJob(row), progress: 0 };
  }
  if (row.status === "saving" || row.status === "starting_3d") {
    // Another request holds this step; take it back only if that request stalled.
    const stalled = Date.now() - Date.parse(row.updatedAt) > SAVE_TIMEOUT_MS;
    if (!stalled) return { job: row, progress: row.status === "saving" ? 100 : 0 };
    row = await update(row, { status: row.status === "saving" ? "submitted" : "styling" });
  }
  if (row.status === "styling" && row.providerTaskId) {
    try {
      return await advanceStyling(row);
    } catch (error) {
      if (error instanceof MeshyError && error.retryable) return { job: row, progress: 0 };
      throw error;
    }
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
