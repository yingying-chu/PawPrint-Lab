import { cleanupExpiredPhotos, retentionDays } from "@/lib/photo-storage";

export const runtime = "edge";

export async function POST() {
  // This site is owner-private. Hosted dispatch (or a Sites service token)
  // is the authorization boundary for this shared maintenance writer.
  const deleted = await cleanupExpiredPhotos();
  return Response.json({ deleted, retentionDays: retentionDays() });
}
