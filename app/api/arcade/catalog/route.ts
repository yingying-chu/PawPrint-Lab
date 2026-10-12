import { arcadeConfigured } from "@/lib/arcade";
import { curatedCatalog, getCatalog } from "@/lib/catalog";
import { arcadeErrorResponse } from "@/lib/designs";

// Public: the catalog holds product names and Arcade's category thumbnails, no user data.
export async function GET() {
  if (!arcadeConfigured()) return Response.json({ configured: false, items: curatedCatalog() });
  try {
    return Response.json({ configured: true, items: await getCatalog() });
  } catch (error) {
    return arcadeErrorResponse(error, "Could not load Arcade products.");
  }
}
