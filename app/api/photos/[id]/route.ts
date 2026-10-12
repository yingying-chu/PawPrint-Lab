import { env } from "@/lib/env";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petPhotos } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const db = getDb();
  const [photo] = await db.select().from(petPhotos).where(
    and(eq(petPhotos.id, id), eq(petPhotos.userId, user.userId)),
  ).limit(1);
  if (!photo) return Response.json({ error: "Photo not found." }, { status: 404 });

  if (env.BUCKET) await env.BUCKET.delete(photo.r2Key);
  await db.delete(petPhotos).where(and(eq(petPhotos.id, id), eq(petPhotos.userId, user.userId)));
  return Response.json({ deleted: true });
}
