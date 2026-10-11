import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { arcadeProducts } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { arcadeConfigured, createCheckout } from "@/lib/arcade";
import { arcadeErrorResponse } from "@/lib/designs";

export const runtime = "edge";

// Creates an unpaid Arcade checkout. Payment happens on Arcade's page, never here.
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!arcadeConfigured()) {
    return Response.json({ error: "Arcade is not connected yet.", code: "ARCADE_NOT_CONFIGURED" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { productIds?: unknown };
  const ids = (Array.isArray(body.productIds) ? body.productIds : [])
    .filter((id): id is string => typeof id === "string")
    .slice(0, 50);
  if (!ids.length) return Response.json({ error: "Choose at least one product." }, { status: 400 });

  const rows = await getDb().select().from(arcadeProducts)
    .where(and(eq(arcadeProducts.userId, user.userId), inArray(arcadeProducts.id, ids)));
  const ready = rows.filter((row) => row.status === "succeeded" && row.productId);
  if (ready.length !== ids.length) {
    return Response.json({ error: "Some products aren't ready yet." }, { status: 409 });
  }
  try {
    const checkout = await createCheckout(
      `checkout-${crypto.randomUUID()}`,
      ready.map((row) => ({ productId: row.productId!, quantity: 1 })),
    );
    return Response.json({ checkoutUrl: checkout.checkoutUrl, checkoutId: checkout.checkoutId });
  } catch (error) {
    return arcadeErrorResponse(error, "Arcade could not create a checkout.");
  }
}
