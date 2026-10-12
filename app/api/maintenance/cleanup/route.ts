import { cleanupExpiredPhotos, retentionDays } from "@/lib/photo-storage";

// Run daily by the Vercel cron in vercel.json, which sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const deleted = await cleanupExpiredPhotos();
  return Response.json({ deleted, retentionDays: retentionDays() });
}
