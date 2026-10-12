import { del, get, put } from "@vercel/blob";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";

/**
 * Private file storage for pet photos, generated art, and 3D models. Keys are
 * opaque paths like `users/<id>/pets/<id>/photos/<id>`; files are only ever
 * served through the API routes, which check the owner first.
 *
 * Deployed, files live in a private Vercel Blob store (BLOB_READ_WRITE_TOKEN).
 * Without that token (local dev) they go in .data/blobs.
 */
export type StoredFile = {
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
};
type Body = ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array;
type PutOptions = { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> };

export type Bucket = {
  get(key: string): Promise<StoredFile | null>;
  put(key: string, body: Body, options?: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
};

const stored = (body: ReadableStream<Uint8Array>): StoredFile => ({
  body,
  arrayBuffer: () => new Response(body).arrayBuffer(),
});

const blobBucket: Bucket = {
  async get(key) {
    const result = await get(key, { access: "private" });
    return result?.statusCode === 200 && result.stream ? stored(result.stream) : null;
  },
  async put(key, body, options) {
    await put(key, body instanceof Uint8Array ? Buffer.from(body) : body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: options?.httpMetadata?.contentType,
    });
  },
  async delete(key) {
    await del(key);
  },
};

const localRoot = resolve(".data/blobs");
const localPath = (key: string) => {
  const path = resolve(localRoot, key);
  if (!path.startsWith(`${localRoot}/`)) throw new Error("Invalid storage key.");
  return path;
};

const localBucket: Bucket = {
  async get(key) {
    const path = localPath(key);
    if (!(await stat(path).catch(() => null))?.isFile()) return null;
    return stored(Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>);
  },
  async put(key, body) {
    const path = localPath(key);
    await mkdir(dirname(path), { recursive: true });
    const bytes = body instanceof ReadableStream ? await new Response(body).arrayBuffer() : body;
    await writeFile(path, new Uint8Array(bytes));
  },
  async delete(key) {
    await rm(localPath(key), { force: true });
  },
};

export function getBucket(): Bucket | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobBucket;
  // A deployment without a Blob store has nowhere durable to write.
  return process.env.VERCEL ? undefined : localBucket;
}
