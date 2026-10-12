import { env } from "@/lib/env";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petAssets } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";

/** Streams the owner's private character or sticker-sheet image from storage. `?download=1` saves it as a file. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const [asset] = await getDb().select().from(petAssets)
    .where(and(eq(petAssets.id, id), eq(petAssets.userId, user.userId)))
    .limit(1);
  const object = asset?.r2Key ? await env.BUCKET?.get(asset.r2Key) : null;
  if (!asset || !object) return Response.json({ error: "Image not found." }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const fileName = `${asset.petName}-${asset.name}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  return new Response(object.body, {
    headers: {
      "Content-Type": asset.contentType ?? "image/png",
      "Cache-Control": "private, max-age=3600",
      ...(download ? { "Content-Disposition": `attachment; filename="${fileName}.png"` } : {}),
    },
  });
}
