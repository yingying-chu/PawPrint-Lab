import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petAssets } from "@/db/schema";
import { MeshyError, downloadAsset, getImageTask, taskErrorMessage, type ImageTaskType } from "@/lib/meshy";
import { privateAssetKey, recordPetId } from "@/lib/photo-storage";

type PetAsset = typeof petAssets.$inferSelect;

export type AssetKind = "character" | "sticker_sheet";

export const CHARACTER_STYLES: Record<string, string> = {
  storybook: "soft storybook illustration with gentle shading",
  cutout: "flat paper-cut style with bold layered shapes",
  minimal: "minimal clean line art with a few flat colors",
};

const subjectOf = (petType: string) => (petType && petType !== "Other" ? petType.toLowerCase() : "pet");

// Photos often show branded harnesses or collars; keep trademarks off printable art.
const NO_MARKS = "No text, letters, logos or brand names anywhere, and no harness, leash or collar.";

/** The pet's own illustrated character: the base asset that stickers and patterns build on. */
export function buildCharacterPrompt(input: {
  petName: string;
  petType: string;
  style: string;
  prompt: string;
  colors: string[];
  fromPhoto: boolean;
}) {
  const subject = subjectOf(input.petType);
  return [
    input.fromPhoto
      ? `Turn the ${subject} in the reference photo into a cute illustrated character, keeping its real markings, fur color and face.`
      : `A cute illustrated character of a ${subject} named ${input.petName}.`,
    `Style: ${CHARACTER_STYLES[input.style] ?? CHARACTER_STYLES.storybook}.`,
    "Full body, centered, clean outline, no background scene.",
    NO_MARKS,
    input.colors.length ? `Use this palette: ${input.colors.join(", ")}.` : "",
    input.prompt,
  ].filter(Boolean).join(" ");
}

/** A 3x3 sheet of nine hand-drawn stickers drawn from an existing character. */
export function buildStickerSheetPrompt(input: { petName: string; petType: string; theme: string; prompt: string }) {
  const subject = subjectOf(input.petType);
  return [
    `Create a hand-drawn sticker pack of ${input.petName}, the ${subject} in the reference image,`,
    input.theme ? `remixing with ${input.theme}.` : "with playful everyday moments.",
    "Use loose imperfect outlines, varied line weight, simple hand-filled colors, and visible handmade marks.",
    "Create a single square (1:1) transparent sticker sheet with nine distinct stickers arranged in a 3x3 grid,",
    "each showing a different expression, pose, or reaction.",
    "Separate the stickers with wide, fully transparent gaps. No background, shadows, or overlapping elements.",
    `Keep ${input.petName}'s real coat colors, markings and face in every sticker.`,
    NO_MARKS,
    input.prompt,
  ].filter(Boolean).join(" ");
}

/** Polls a running Meshy image task and copies the finished image into private storage. */
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
      // Signed storage URLs can answer with a generic binary type; Meshy returns PNGs.
      const contentType = download.contentType.startsWith("image/") ? download.contentType : "image/png";
      const r2Key = privateAssetKey(row.userId, recordPetId(row.userId, row.petKey), "assets", row.id);
      await env.BUCKET!.put(r2Key, bytes, { httpMetadata: { contentType } });
      return save({ status: "succeeded", r2Key, contentType, error: null });
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      return save({ status: "failed", error: taskErrorMessage(task, "Meshy could not draw this.") });
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
    kind: row.kind as AssetKind,
    sourceAssetId: row.sourceAssetId,
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
