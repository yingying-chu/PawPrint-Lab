import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { twinJobs } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { refreshTwinJob, serializeTwinJob } from "@/lib/twins";

export const runtime = "edge";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const [row] = await getDb().select().from(twinJobs)
    .where(and(eq(twinJobs.id, id), eq(twinJobs.userId, user.userId)))
    .limit(1);
  if (!row) return Response.json({ error: "Twin job not found." }, { status: 404 });
  try {
    const { job, progress } = await refreshTwinJob(row);
    return Response.json({ job: serializeTwinJob(job, progress) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not check the 3D job." }, { status: 502 });
  }
}
