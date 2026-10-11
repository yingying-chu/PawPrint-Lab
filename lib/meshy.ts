import { env } from "cloudflare:workers";

// Server-only client for the Meshy API (https://docs.meshy.ai). Never import from browser code.
const API_BASE = "https://api.meshy.ai/openapi/v1";

export class MeshyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MeshyError";
  }

  get retryable() {
    return this.status === 429 || this.status >= 500;
  }
}

export function meshyConfigured() {
  return Boolean(env.MESHY_API_KEY);
}

async function call<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  if (!env.MESHY_API_KEY) throw new MeshyError("Meshy is not configured yet.", 503);
  const response = await fetch(`${API_BASE}/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${env.MESHY_API_KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = response.status === 402
      ? "The Meshy account is out of credits."
      : String(payload.message ?? `Meshy request failed (${response.status})`);
    throw new MeshyError(message, response.status);
  }
  return payload as T;
}

export type MeshyStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";

type MeshyTask = {
  id: string;
  status: MeshyStatus;
  progress: number;
  task_error?: { message?: string } | null;
};

export type MeshyImageTask = MeshyTask & { image_urls?: string[] };
export type MeshyModelTask = MeshyTask & {
  model_urls?: { glb?: string };
  thumbnail_url?: string;
};

export type ImageTaskType = "text-to-image" | "image-to-image";

// nano-banana-2 balances quality and cost (6 credits per image); nano-banana-pro
// (9 credits) follows detailed edits such as removing a leash more reliably.
export type ImageModel = "nano-banana-2" | "nano-banana-pro";

/** Generates one image, guided by reference photos when given. Returns the task to poll. */
export async function createImageTask(input: {
  prompt: string;
  referenceImageUrls?: string[];
  removeBackground?: boolean;
  model?: ImageModel;
}) {
  const type: ImageTaskType = input.referenceImageUrls?.length ? "image-to-image" : "text-to-image";
  const { result } = await call<{ result: string }>(type, {
    ai_model: input.model ?? "nano-banana-2",
    prompt: input.prompt.slice(0, 1000),
    aspect_ratio: "1:1",
    remove_background: input.removeBackground ?? false,
    ...(type === "image-to-image" ? { reference_image_urls: input.referenceImageUrls!.slice(0, 5) } : {}),
  });
  return { taskId: result, type };
}

export const getImageTask = (type: ImageTaskType, taskId: string) =>
  call<MeshyImageTask>(`${type}/${encodeURIComponent(taskId)}`);

/** Starts image-to-3D from an image, or from a finished single-image Meshy task. */
export async function createImageTo3DTask(input: { imageUrl: string } | { inputTaskId: string }) {
  return call<{ result: string }>("image-to-3d", {
    ...("inputTaskId" in input ? { input_task_id: input.inputTaskId } : { image_url: input.imageUrl }),
    ai_model: "latest",
    model_type: "standard",
    // Default Meshy output can approach 100 MB; a remeshed ~30k-triangle model with a
    // single base-colour texture is a few MB and plenty for an on-screen pet.
    should_remesh: true,
    target_polycount: 30000,
    should_texture: true,
    enable_pbr: false,
    target_formats: ["glb"],
  });
}

export const getImageTo3DTask = (taskId: string) =>
  call<MeshyModelTask>(`image-to-3d/${encodeURIComponent(taskId)}`);

export function taskErrorMessage(task: MeshyTask, fallback: string) {
  return (task.task_error?.message || fallback).slice(0, 500);
}

/** Downloads a Meshy asset before its signed URL expires. */
export async function downloadAsset(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new MeshyError(`Could not download the Meshy result (${response.status})`, response.status);
  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

/**
 * Streams a Meshy asset into R2 without holding it in memory; 3D models can be
 * larger than a Worker's memory limit.
 */
export async function copyAssetToBucket(url: string, key: string, contentType: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new MeshyError(`Could not download the Meshy result (${response.status})`, response.status);
  }
  const length = Number(response.headers.get("content-length"));
  if (!(length > 0)) {
    await env.BUCKET!.put(key, await response.arrayBuffer(), { httpMetadata: { contentType } });
    return;
  }
  // R2 only accepts a stream of known length; FixedLengthStream supplies it.
  const { readable, writable } = new FixedLengthStream(length);
  await Promise.all([
    response.body.pipeTo(writable),
    env.BUCKET!.put(key, readable, { httpMetadata: { contentType } }),
  ]);
}

export function arrayBufferToDataUrl(buffer: ArrayBuffer, contentType: string) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}
