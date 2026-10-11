import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { designs } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { arcadeErrorResponse, refreshDesign, serializeDesign } from "@/lib/designs";

export const runtime = "edge";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const [row] = await getDb().select().from(designs)
    .where(and(eq(designs.id, id), eq(designs.userId, user.userId)))
    .limit(1);
  if (!row) return Response.json({ error: "Design not found." }, { status: 404 });
  try {
    return Response.json({ design: await serializeDesign(await refreshDesign(row)) });
  } catch (error) {
    return arcadeErrorResponse(error, "Could not check this design.");
  }
}
