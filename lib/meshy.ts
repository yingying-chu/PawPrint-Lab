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

// nano-banana-2 balances quality and cost (6 credits per image for both endpoints).
const IMAGE_MODEL = "nano-banana-2";

/** Generates one image, guided by reference photos when given. Returns the task to poll. */
export async function createImageTask(input: {
  prompt: string;
  referenceImageUrls?: string[];
  removeBackground?: boolean;
}) {
  const type: ImageTaskType = input.referenceImageUrls?.length ? "image-to-image" : "text-to-image";
  const { result } = await call<{ result: string }>(type, {
    ai_model: IMAGE_MODEL,
    prompt: input.prompt.slice(0, 1000),
    aspect_ratio: "1:1",
    remove_background: input.removeBackground ?? false,
    ...(type === "image-to-image" ? { reference_image_urls: input.referenceImageUrls!.slice(0, 5) } : {}),
  });
  return { taskId: result, type };
}

export const getImageTask = (type: ImageTaskType, taskId: string) =>
  call<MeshyImageTask>(`${type}/${encodeURIComponent(taskId)}`);

export async function createImageTo3DTask(imageUrl: string) {
  return call<{ result: string }>("image-to-3d", {
    image_url: imageUrl,
    ai_model: "latest",
    model_type: "standard",
    should_remesh: false,
    should_texture: true,
    enable_pbr: true,
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

export function arrayBufferToDataUrl(buffer: ArrayBuffer, contentType: string) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}
