import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petAssets } from "@/db/schema";
import { MeshyError, downloadAsset, getImageTask, taskErrorMessage, type ImageTaskType } from "@/lib/meshy";
import { privateAssetKey, recordPetId } from "@/lib/photo-storage";

type PetAsset = typeof petAssets.$inferSelect;

export const STICKER_STYLES: Record<string, string> = {
  storybook: "soft storybook illustration with gentle shading",
  cutout: "flat paper-cut style with bold layered shapes",
  minimal: "minimal clean line art with a few flat colors",
};

export function buildStickerPrompt(input: {
  petName: string;
  petType: string;
  style: string;
  prompt: string;
  colors: string[];
  fromPhoto: boolean;
}) {
  const subject = input.petType && input.petType !== "Other" ? input.petType.toLowerCase() : "pet";
  return [
    input.fromPhoto
      ? `Turn the ${subject} in the reference photo into a cute die-cut sticker character, keeping its real markings, fur color and face.`
      : `A cute die-cut sticker character of a ${subject} named ${input.petName}.`,
    `Style: ${STICKER_STYLES[input.style] ?? STICKER_STYLES.storybook}.`,
    "Full body, centered, thick clean outline, no text, no background scene.",
    input.colors.length ? `Use this palette: ${input.colors.join(", ")}.` : "",
    input.prompt,
  ].filter(Boolean).join(" ");
}

/** Polls a running sticker task and copies a finished image into private storage. */
export async function refreshCharacter(row: PetAsset): Promise<PetAsset> {
  if (row.status !== "running") return row;
  const save = async (changes: Partial<PetAsset>) => {
    const updated = { ...changes, updatedAt: new Date().toISOString() };
    await getDb().update(petAssets).set(updated).where(eq(petAssets.id, row.id));
    return { ...row, ...updated };
  };
  try {
    const task = await getImageTask(row.providerTaskType as ImageTaskType, row.providerTaskId);
    if (task.status === "SUCCEEDED") {
      const url = task.image_urls?.[0];
      if (!url) return save({ status: "failed", error: "Meshy returned no image." });
      const download = await downloadAsset(url);
      const bytes = download.bytes;
      // Signed storage URLs can answer with a generic binary type; stickers are PNGs.
      const contentType = download.contentType.startsWith("image/") ? download.contentType : "image/png";
      const r2Key = privateAssetKey(row.userId, recordPetId(row.userId, row.petKey), "assets", row.id);
      await env.BUCKET!.put(r2Key, bytes, { httpMetadata: { contentType } });
      return save({ status: "succeeded", r2Key, contentType, error: null });
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      return save({ status: "failed", error: taskErrorMessage(task, "Meshy could not create this sticker.") });
    }
    return row;
  } catch (error) {
    if (error instanceof MeshyError && error.retryable) return row;
    throw error;
  }
}

export function serializeCharacter(row: PetAsset) {
  return {
    id: row.id,
    petKey: row.petKey,
    kind: row.kind,
    name: row.name,
    prompt: row.prompt,
    style: row.style,
    usedPhoto: Boolean(row.photoId),
    status: row.status,
    error: row.error,
    imageUrl: row.status === "succeeded" && row.r2Key ? `/api/characters/${row.id}/image` : null,
    createdAt: row.createdAt,
  };
}
