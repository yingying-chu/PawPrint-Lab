import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { arcadeProducts, designs } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { arcadeConfigured, createProduct, getCategoryDefaults } from "@/lib/arcade";
import { getCatalog } from "@/lib/catalog";
import { arcadeErrorResponse, refreshProduct, serializeProduct } from "@/lib/designs";

export const runtime = "edge";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const designId = new URL(request.url).searchParams.get("designId")?.trim();
  if (!designId) return Response.json({ error: "designId is required." }, { status: 400 });
  const rows = await getDb().select().from(arcadeProducts)
    .where(and(eq(arcadeProducts.userId, user.userId), eq(arcadeProducts.designId, designId)))
    .orderBy(desc(arcadeProducts.createdAt))
    .limit(20);
  const refreshed = await Promise.all(rows.map((row) => refreshProduct(row).catch(() => row)));
  return Response.json({ products: await Promise.all(refreshed.map(serializeProduct)) });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!arcadeConfigured()) {
    return Response.json({ error: "Arcade is not connected yet.", code: "ARCADE_NOT_CONFIGURED" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { designId?: string; categoryId?: string };
  const db = getDb();
  const [design] = await db.select().from(designs)
    .where(and(eq(designs.id, String(body.designId ?? "")), eq(designs.userId, user.userId)))
    .limit(1);
  if (!design) return Response.json({ error: "Design not found." }, { status: 404 });
  if (design.status !== "succeeded" || !design.patternId) {
    return Response.json({ error: "This design is not ready yet." }, { status: 409 });
  }

  try {
    const category = (await getCatalog()).find((item) => item.categoryId === body.categoryId);
    if (!category) return Response.json({ error: "That product isn't offered here." }, { status: 400 });

    // Reuse a product already made (or being made) from this design in this category.
    const [existing] = await db.select().from(arcadeProducts).where(and(
      eq(arcadeProducts.userId, user.userId),
      eq(arcadeProducts.designId, design.id),
      eq(arcadeProducts.categoryId, category.categoryId),
    )).orderBy(desc(arcadeProducts.createdAt)).limit(1);
    if (existing && existing.status !== "failed") {
      return Response.json({ product: await serializeProduct(await refreshProduct(existing)) });
    }

    const defaults = await getCategoryDefaults(category.categoryId);
    if (!defaults.canManufacture) {
      return Response.json({ error: `${category.name} can't be made right now.` }, { status: 422 });
    }
    const id = crypto.randomUUID();
    const job = await createProduct({
      requestId: `product-${id}`,
      patternId: design.patternId,
      categoryId: category.categoryId,
      selections: defaults.selections,
    });
    const now = new Date().toISOString();
    const row = {
      id,
      userId: user.userId,
      designId: design.id,
      categoryId: category.categoryId,
      categoryName: category.name,
      arcadeJobId: job.jobId,
      productId: job.status === "succeeded" ? job.result?.productId ?? null : null,
      status: job.status === "succeeded" && job.result?.productId ? "succeeded" : job.status === "failed" ? "failed" : "running",
      error: job.error?.message ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(arcadeProducts).values(row);
    return Response.json({ product: await serializeProduct(row) }, { status: 202 });
  } catch (error) {
    return arcadeErrorResponse(error, "Arcade could not start this product.");
  }
}
