import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { arcadeProducts } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { arcadeErrorResponse, refreshProduct, serializeProduct } from "@/lib/designs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const [row] = await getDb().select().from(arcadeProducts)
    .where(and(eq(arcadeProducts.id, id), eq(arcadeProducts.userId, user.userId)))
    .limit(1);
  if (!row) return Response.json({ error: "Product not found." }, { status: 404 });
  try {
    return Response.json({ product: await serializeProduct(await refreshProduct(row)) });
  } catch (error) {
    return arcadeErrorResponse(error, "Could not check this product.");
  }
}
