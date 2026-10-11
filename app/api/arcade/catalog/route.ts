import { getApiUser, unauthorized } from "@/lib/api-auth";
import { arcadeConfigured } from "@/lib/arcade";
import { getCatalog } from "@/lib/catalog";
import { arcadeErrorResponse } from "@/lib/designs";

export const runtime = "edge";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!arcadeConfigured()) return Response.json({ configured: false, items: [] });
  try {
    return Response.json({ configured: true, items: await getCatalog() });
  } catch (error) {
    return arcadeErrorResponse(error, "Could not load Arcade products.");
  }
}
