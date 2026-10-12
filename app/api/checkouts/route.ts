import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { arcadeProducts } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { arcadeConfigured, createCheckout } from "@/lib/arcade";
import { arcadeErrorResponse } from "@/lib/designs";

// Creates an unpaid Arcade checkout. Payment happens on Arcade's page, never here.
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!arcadeConfigured()) {
    return Response.json({ error: "Arcade is not connected yet.", code: "ARCADE_NOT_CONFIGURED" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { productIds?: unknown; lines?: unknown };
  // `lines` carries bag quantities; `productIds` (one of each) is the older form.
  const requested = new Map<string, number>();
  for (const line of Array.isArray(body.lines) ? body.lines : []) {
    const { productId, quantity } = (line ?? {}) as { productId?: unknown; quantity?: unknown };
    if (typeof productId !== "string") continue;
    const qty = Number.isInteger(quantity) ? Math.min(Math.max(quantity as number, 1), 99) : 1;
    requested.set(productId, (requested.get(productId) ?? 0) + qty);
  }
  for (const id of Array.isArray(body.productIds) ? body.productIds : []) {
    if (typeof id === "string" && !requested.has(id)) requested.set(id, 1);
  }
  const ids = [...requested.keys()].slice(0, 50);
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
      ready.map((row) => ({ productId: row.productId!, quantity: requested.get(row.id) ?? 1 })),
    );
    return Response.json({ checkoutUrl: checkout.checkoutUrl, checkoutId: checkout.checkoutId });
  } catch (error) {
    return arcadeErrorResponse(error, "Arcade could not create a checkout.");
  }
}
