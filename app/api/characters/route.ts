import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petAssets, petPhotos } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { STICKER_STYLES, buildStickerPrompt, refreshCharacter, serializeCharacter } from "@/lib/characters";
import { MeshyError, arrayBufferToDataUrl, createImageTask, meshyConfigured } from "@/lib/meshy";

export const runtime = "edge";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const petKey = new URL(request.url).searchParams.get("petKey")?.trim();
  if (!petKey) return Response.json({ error: "petKey is required." }, { status: 400 });
  const rows = await getDb().select().from(petAssets)
    .where(and(eq(petAssets.userId, user.userId), eq(petAssets.petKey, petKey)))
    .orderBy(desc(petAssets.createdAt))
    .limit(24);
  const refreshed = await Promise.all(rows.map((row) => refreshCharacter(row).catch(() => row)));
  return Response.json({ configured: meshyConfigured(), characters: refreshed.map(serializeCharacter) });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!meshyConfigured()) {
    return Response.json({ error: "Meshy is not connected yet.", code: "MESHY_NOT_CONFIGURED" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as {
    petKey?: string;
    petName?: string;
    petType?: string;
    prompt?: string;
    style?: string;
    colors?: unknown;
    photoId?: string;
  };
  const petKey = String(body.petKey ?? "").trim().slice(0, 80);
  const petName = String(body.petName ?? "").trim().slice(0, 40);
  const userPrompt = String(body.prompt ?? "").trim().slice(0, 600);
  const style = body.style && body.style in STICKER_STYLES ? body.style : "storybook";
  const colors = (Array.isArray(body.colors) ? body.colors : [])
    .filter((color): color is string => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))
    .slice(0, 5);
  if (!petKey || !petName) return Response.json({ error: "Pet name and profile are required." }, { status: 400 });

  const db = getDb();
  const running = await db.select().from(petAssets)
    .where(and(eq(petAssets.userId, user.userId), eq(petAssets.status, "running")));
  const stillRunning = (await Promise.all(running.map((row) => refreshCharacter(row).catch(() => row))))
    .filter((row) => row.status === "running");
  if (stillRunning.length) {
    return Response.json(
      { error: "A sticker is still being drawn. Try again when it finishes.", characterId: stillRunning[0].id },
      { status: 429 },
    );
  }

  // The pet photo is only shared with Meshy when the owner explicitly sends its id.
  const referenceImageUrls: string[] = [];
  let photoId: string | null = null;
  if (body.photoId) {
    const [photo] = await db.select().from(petPhotos)
      .where(and(eq(petPhotos.id, body.photoId), eq(petPhotos.userId, user.userId)))
      .limit(1);
    const object = photo ? await env.BUCKET?.get(photo.r2Key) : null;
    if (!photo || !object) return Response.json({ error: "Saved photo not found or expired." }, { status: 404 });
    referenceImageUrls.push(arrayBufferToDataUrl(await object.arrayBuffer(), photo.contentType));
    photoId = photo.id;
  }

  try {
    const task = await createImageTask({
      prompt: buildStickerPrompt({
        petName,
        petType: String(body.petType ?? ""),
        style,
        prompt: userPrompt,
        colors,
        fromPhoto: Boolean(photoId),
      }),
      referenceImageUrls,
      removeBackground: true,
    });
    const existing = await db.select({ id: petAssets.id }).from(petAssets)
      .where(and(eq(petAssets.userId, user.userId), eq(petAssets.petKey, petKey)));
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      userId: user.userId,
      petKey,
      petName,
      kind: "sticker",
      name: `Sticker ${existing.length + 1}`,
      prompt: userPrompt,
      style,
      photoId,
      provider: "meshy",
      providerTaskType: task.type,
      providerTaskId: task.taskId,
      status: "running",
      r2Key: null,
      contentType: null,
      arcadeReferenceId: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(petAssets).values(row);
    return Response.json({ character: serializeCharacter(row) }, { status: 202 });
  } catch (error) {
    const status = error instanceof MeshyError ? (error.status === 401 ? 502 : error.status) : 500;
    const message = error instanceof MeshyError && error.status === 401
      ? "Meshy rejected the server's API key. Check MESHY_API_KEY."
      : error instanceof Error ? error.message : "Meshy could not start this sticker.";
    return Response.json({ error: message }, { status });
  }
}
