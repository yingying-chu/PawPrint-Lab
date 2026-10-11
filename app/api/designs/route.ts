import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { designs, petAssets, petPhotos } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import {
  ARCADE_REFERENCE_MAX_BYTES,
  ARCADE_REFERENCE_TYPES,
  arcadeConfigured,
  createPattern,
  createReference,
} from "@/lib/arcade";
import {
  DESIGN_STYLES,
  arcadeErrorResponse,
  buildPrompt,
  refreshDesign,
  serializeDesign,
} from "@/lib/designs";

export const runtime = "edge";

const notConfigured = () => Response.json(
  { error: "Arcade is not connected yet.", code: "ARCADE_NOT_CONFIGURED" },
  { status: 503 },
);

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const petKey = new URL(request.url).searchParams.get("petKey")?.trim();
  if (!petKey) return Response.json({ error: "petKey is required." }, { status: 400 });

  const rows = await getDb().select().from(designs)
    .where(and(eq(designs.userId, user.userId), eq(designs.petKey, petKey)))
    .orderBy(desc(designs.createdAt))
    .limit(12);
  // A row Arcade can't report on is shown as last stored rather than failing the list.
  const refreshed = await Promise.all(rows.map((row) => refreshDesign(row).catch(() => row)));
  return Response.json({
    configured: arcadeConfigured(),
    designs: await Promise.all(refreshed.map(serializeDesign)),
  });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!arcadeConfigured()) return notConfigured();

  const body = await request.json().catch(() => ({})) as {
    petKey?: string;
    petName?: string;
    petType?: string;
    prompt?: string;
    style?: string;
    colors?: unknown;
    photoId?: string;
    characterId?: string;
  };
  const petKey = String(body.petKey ?? "").trim().slice(0, 80);
  const petName = String(body.petName ?? "").trim().slice(0, 40);
  const userPrompt = String(body.prompt ?? "").trim().slice(0, 600);
  const style = body.style && body.style in DESIGN_STYLES ? body.style : "storybook";
  const colors = (Array.isArray(body.colors) ? body.colors : [])
    .filter((color): color is string => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))
    .slice(0, 5);
  if (!petKey || !petName) return Response.json({ error: "Pet name and profile are required." }, { status: 400 });
  if (!userPrompt) return Response.json({ error: "Describe the design you want." }, { status: 400 });

  const db = getDb();
  // Arcade asks integrators to run one generation at a time.
  const running = await db.select().from(designs)
    .where(and(eq(designs.userId, user.userId), eq(designs.status, "running")));
  const stillRunning = (await Promise.all(running.map((row) => refreshDesign(row).catch(() => row)))).filter((row) => row.status === "running");
  if (stillRunning.length) {
    return Response.json(
      { error: "A design is still generating. Try again when it finishes.", designId: stillRunning[0].id },
      { status: 429 },
    );
  }

  // The pet photo is only shared with Arcade when the owner explicitly sends its id.
  const referenceIds: string[] = [];
  let photoId: string | null = null;
  if (body.photoId) {
    const [photo] = await db.select().from(petPhotos)
      .where(and(eq(petPhotos.id, body.photoId), eq(petPhotos.userId, user.userId)))
      .limit(1);
    if (!photo) return Response.json({ error: "Saved photo not found or expired." }, { status: 404 });
    if (!ARCADE_REFERENCE_TYPES.includes(photo.contentType)) {
      return Response.json({ error: "Arcade accepts JPEG, PNG, WebP, or GIF photos." }, { status: 415 });
    }
    try {
      let referenceId = photo.arcadeReferenceId;
      if (!referenceId) {
        const object = await env.BUCKET?.get(photo.r2Key);
        if (!object) return Response.json({ error: "Saved photo has expired." }, { status: 410 });
        const bytes = await object.arrayBuffer();
        if (bytes.byteLength > ARCADE_REFERENCE_MAX_BYTES) {
          return Response.json({ error: "Photo is too large to use as a reference." }, { status: 413 });
        }
        referenceId = await createReference(bytes, photo.contentType, `${photo.id}-${Date.now()}`);
        await db.update(petPhotos).set({ arcadeReferenceId: referenceId }).where(eq(petPhotos.id, photo.id));
      }
      referenceIds.push(referenceId);
      photoId = photo.id;
    } catch (error) {
      return arcadeErrorResponse(error, "Could not share the photo with Arcade.");
    }
  }

  // A generated sticker can also guide the pattern; it is already the owner's artwork.
  if (body.characterId) {
    const [asset] = await db.select().from(petAssets)
      .where(and(eq(petAssets.id, body.characterId), eq(petAssets.userId, user.userId)))
      .limit(1);
    if (!asset || asset.status !== "succeeded" || !asset.r2Key) {
      return Response.json({ error: "That sticker isn't ready." }, { status: 404 });
    }
    try {
      let referenceId = asset.arcadeReferenceId;
      if (!referenceId) {
        const object = await env.BUCKET?.get(asset.r2Key);
        if (!object) return Response.json({ error: "Sticker image is missing." }, { status: 410 });
        const contentType = asset.contentType && ARCADE_REFERENCE_TYPES.includes(asset.contentType) ? asset.contentType : "image/png";
        referenceId = await createReference(await object.arrayBuffer(), contentType, `${asset.id}-${Date.now()}`);
        await db.update(petAssets).set({ arcadeReferenceId: referenceId }).where(eq(petAssets.id, asset.id));
      }
      referenceIds.push(referenceId);
    } catch (error) {
      return arcadeErrorResponse(error, "Could not share the sticker with Arcade.");
    }
  }

  const existing = await db.select({ id: designs.id }).from(designs)
    .where(and(eq(designs.userId, user.userId), eq(designs.petKey, petKey)));
  const id = crypto.randomUUID();
  try {
    const job = await createPattern({
      requestId: `design-${id}`,
      prompt: buildPrompt({
        petName,
        petType: String(body.petType ?? ""),
        style,
        prompt: userPrompt,
        fromCharacter: Boolean(body.characterId),
      }),
      referenceIds,
      colors,
    });
    const now = new Date().toISOString();
    const row = {
      id,
      userId: user.userId,
      petKey,
      petName,
      name: `Design ${existing.length + 1}`,
      prompt: userPrompt,
      style,
      colors: JSON.stringify(colors),
      photoId,
      arcadeJobId: job.jobId,
      patternId: job.status === "succeeded" ? job.result?.patternId ?? null : null,
      status: job.status === "succeeded" && job.result?.patternId ? "succeeded" : job.status === "failed" ? "failed" : "running",
      error: job.error?.message ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(designs).values(row);
    return Response.json({ design: await serializeDesign(row) }, { status: 202 });
  } catch (error) {
    return arcadeErrorResponse(error, "Arcade could not start this design.");
  }
}
