import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { arcadeProducts, designs } from "@/db/schema";
import { ArcadeError, getJob, getPattern, getProduct } from "@/lib/arcade";

type DesignRow = typeof designs.$inferSelect;
type ProductRow = typeof arcadeProducts.$inferSelect;

export const DESIGN_STYLES: Record<string, string> = {
  storybook: "soft storybook watercolor illustration",
  cutout: "layered paper-cut collage with crisp shapes",
  minimal: "minimal single-weight line drawing",
};

export function buildPrompt(input: {
  petName: string;
  petType: string;
  style: string;
  prompt: string;
  fromCharacter?: boolean;
}) {
  const subject = input.petType && input.petType !== "Other" ? input.petType.toLowerCase() : "pet";
  return [
    `A repeating textile pattern celebrating a ${subject} named ${input.petName}.`,
    // Arcade only prints its own patterns, so a character reference has to become the motif.
    input.fromCharacter
      ? `Feature the character from the reference image as the main motif, large and clearly recognisable, keeping its face, coat colours and proportions.`
      : "",
    `Style: ${DESIGN_STYLES[input.style] ?? DESIGN_STYLES.storybook}.`,
    "No text, letters or logos.",
    input.prompt,
  ].filter(Boolean).join(" ").slice(0, 1000);
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.slice(0, 500) : fallback;
}

export function arcadeErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof ArcadeError
    ? (error.status === 401 || error.status === 403 ? 502 : error.status >= 400 && error.status < 600 ? error.status : 502)
    : 500;
  // Arcade 401/403 means our server key is wrong, not that the visitor is signed out.
  const message = error instanceof ArcadeError && (error.status === 401 || error.status === 403)
    ? "Arcade rejected the server's API key. Check ARCADE_API_KEY."
    : errorMessage(error, fallback);
  return Response.json({ error: message }, { status });
}

/** Advances a running Arcade job by one poll. Transient Arcade errors leave the row unchanged. */
async function pollJob<T extends DesignRow | ProductRow>(
  row: T,
  apply: (job: Awaited<ReturnType<typeof getJob>>) => Partial<T> | null,
  table: typeof designs | typeof arcadeProducts,
): Promise<T> {
  if (row.status !== "running" || !row.arcadeJobId) return row;
  try {
    const job = await getJob(row.arcadeJobId);
    const changes = apply(job);
    if (!changes) return row;
    const updated = { ...changes, updatedAt: new Date().toISOString() } as Partial<T>;
    await getDb().update(table).set(updated).where(eq(table.id, row.id));
    return { ...row, ...updated };
  } catch (error) {
    if (error instanceof ArcadeError && error.retryable) return row;
    throw error;
  }
}

export function refreshDesign(row: DesignRow) {
  return pollJob(row, (job) => {
    if (job.status === "running") return null;
    if (job.status === "succeeded" && job.result?.patternId) {
      return { status: "succeeded", patternId: job.result.patternId, error: null };
    }
    return { status: "failed", error: job.error?.message?.slice(0, 500) ?? "Arcade could not finish this design." };
  }, designs);
}

export function refreshProduct(row: ProductRow) {
  return pollJob(row, (job) => {
    if (job.status === "running") return null;
    if (job.status === "succeeded" && job.result?.productId) {
      return { status: "succeeded", productId: job.result.productId, error: null };
    }
    return { status: "failed", error: job.error?.message?.slice(0, 500) ?? "Arcade could not build this product." };
  }, arcadeProducts);
}

/** Image URLs from Arcade expire, so they are fetched fresh on every read and never stored. */
export async function serializeDesign(row: DesignRow) {
  let image: { imageUrl: string; thumbnailUrl: string } | null = null;
  if (row.status === "succeeded" && row.patternId) {
    try {
      const pattern = await getPattern(row.patternId);
      image = { imageUrl: pattern.imageUrl, thumbnailUrl: pattern.thumbnailUrl };
    } catch {
      image = null;
    }
  }
  return {
    id: row.id,
    petKey: row.petKey,
    name: row.name,
    prompt: row.prompt,
    style: row.style,
    colors: JSON.parse(row.colors) as string[],
    usedPhoto: Boolean(row.photoId),
    status: row.status,
    error: row.error,
    createdAt: row.createdAt,
    ...image,
  };
}

export async function serializeProduct(row: ProductRow) {
  let details: Record<string, unknown> | null = null;
  if (row.status === "succeeded" && row.productId) {
    try {
      const product = await getProduct(row.productId);
      details = {
        title: product.title,
        imageUrl: product.imageUrl,
        selectionLabel: product.selectionLabel,
        unitPrice: product.unitPrice,
      };
    } catch {
      details = null;
    }
  }
  return {
    id: row.id,
    designId: row.designId,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    status: row.status,
    error: row.error,
    ...details,
  };
}
