import { env } from "@/lib/env";

// Server-only client for the Arcade public API (https://docs.arcade.ai).
// Every procedure is a POST with a JSON body. Never import this from browser code.
const API_BASE = "https://platform.arcade.ai/v1";
const DEFAULT_USER_AGENT = "pawprint-atelier/0.1 (arcade-hackathon)";

export class ArcadeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ArcadeError";
  }

  get retryable() {
    return this.status === 429 || this.status === 409 || this.status >= 500;
  }
}

export function arcadeConfigured() {
  return Boolean(env.ARCADE_API_KEY);
}

async function call<T>(procedure: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!env.ARCADE_API_KEY) throw new ArcadeError("Arcade is not configured yet.", 503, "NOT_CONFIGURED");
  const response = await fetch(`${API_BASE}/${procedure}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.ARCADE_API_KEY}`,
      "Content-Type": "application/json",
      // Arcade's edge rejects requests without a descriptive User-Agent.
      "User-Agent": env.ARCADE_USER_AGENT || DEFAULT_USER_AGENT,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    // The edge can answer with plain text (e.g. 403 for a missing User-Agent).
  }
  if (!response.ok) {
    const message = typeof payload.message === "string"
      ? payload.message
      : `Arcade ${procedure} failed (${response.status})`;
    throw new ArcadeError(message, response.status, typeof payload.code === "string" ? payload.code : null);
  }
  return payload as T;
}

export type ArcadeJob = {
  jobId: string;
  kind: "pattern" | "product" | "download";
  status: "running" | "succeeded" | "failed";
  result: { patternId?: string; productId?: string } | null;
  error: { message: string } | null;
};

export type ArcadePattern = {
  patternId: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
};

export type ArcadeCategory = {
  categoryId: string;
  name: string;
  imageUrl: string | null;
  world: "print" | "jewelry";
};

export type ArcadeCategoryDetail = ArcadeCategory & {
  selections: Record<string, string>;
  canManufacture: boolean;
};

export type ArcadeProduct = {
  productId: string;
  title: string;
  imageUrl: string;
  images: { url: string }[];
  selectionLabel: string;
  unitPrice: { amount: string; currency: string } | null;
};

export const ARCADE_REFERENCE_TYPES = ["image/gif", "image/jpeg", "image/png", "image/webp"];
export const ARCADE_REFERENCE_MAX_BYTES = 10 * 1024 * 1024;

/** Uploads image bytes as an Arcade reference and returns its referenceId. */
export async function createReference(bytes: ArrayBuffer, mediaType: string, requestKey: string) {
  const upload = await call<{
    uploadId: string;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
  }>("references/createUpload", {
    requestId: `upload-${requestKey}`,
    mediaType,
    byteLength: bytes.byteLength,
  });
  // The signed upload URL may live on another host: send it no Arcade credentials.
  const put = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.requiredHeaders, body: bytes });
  if (!put.ok) throw new ArcadeError(`Reference upload failed (${put.status})`, put.status);
  const reference = await call<{ referenceId: string }>("references/create", {
    requestId: `reference-${upload.uploadId}`,
    uploadId: upload.uploadId,
  });
  return reference.referenceId;
}

export function createPattern(input: {
  requestId: string;
  prompt: string;
  referenceIds?: string[];
  colors?: string[];
  // A jewelry category makes the design and its product in one job (no references or colors).
  categoryId?: string;
}) {
  return call<ArcadeJob>("patterns/create", {
    requestId: input.requestId,
    prompt: input.prompt,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.referenceIds?.length ? { referenceIds: input.referenceIds } : {}),
    ...(input.colors?.length ? { colors: input.colors } : {}),
  });
}

export const getJob = (jobId: string) => call<ArcadeJob>("jobs/get", { jobId });
export const getPattern = (patternId: string) => call<ArcadePattern>("patterns/get", { patternId });
export const getProduct = (productId: string) => call<ArcadeProduct>("products/get", { productId });

let categoryCache: { at: number; items: ArcadeCategory[] } | null = null;

export async function listCategories() {
  if (categoryCache && Date.now() - categoryCache.at < 10 * 60 * 1000) return categoryCache.items;
  const { items } = await call<{ items: ArcadeCategory[] }>("categories/list");
  categoryCache = { at: Date.now(), items };
  return items;
}

/** Returns the default complete selection Arcade fills in for a category. */
export const getCategoryDefaults = (categoryId: string) =>
  call<ArcadeCategoryDetail>("categories/get", { categoryId, selections: {} });

export function createProduct(input: {
  requestId: string;
  patternId: string;
  categoryId: string;
  selections: Record<string, string>;
}) {
  // "fill" lets Arcade fit the pattern when its aspect ratio differs from the product.
  return call<ArcadeJob>("products/create", { ...input, fit: { mode: "fill" } });
}

export function createCheckout(requestId: string, lines: { productId: string; quantity: number }[]) {
  // Without a subscription, Arcade only ships single pieces with its drop-ship service (412 otherwise).
  const dropShip = lines.some((line) => line.quantity === 1);
  return call<{ checkoutId: string; checkoutUrl: string }>("checkouts/create", {
    requestId,
    lines,
    ...(dropShip ? { dropShip: true } : {}),
  });
}
