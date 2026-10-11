import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { petAssets } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { refreshCharacter, serializeCharacter } from "@/lib/characters";

export const runtime = "edge";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const [row] = await getDb().select().from(petAssets)
    .where(and(eq(petAssets.id, id), eq(petAssets.userId, user.userId)))
    .limit(1);
  if (!row) return Response.json({ error: "Sticker not found." }, { status: 404 });
  try {
    return Response.json({ character: serializeCharacter(await refreshCharacter(row)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not check this sticker." }, { status: 502 });
  }
}
