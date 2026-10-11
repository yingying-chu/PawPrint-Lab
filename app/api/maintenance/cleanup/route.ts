import { getApiUser, unauthorized } from "@/lib/api-auth";
import { cleanupExpiredPhotos, retentionDays } from "@/lib/photo-storage";

export const runtime = "edge";

export async function POST() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const deleted = await cleanupExpiredPhotos(user.userId);
  return Response.json({ deleted, retentionDays: retentionDays() });
}
