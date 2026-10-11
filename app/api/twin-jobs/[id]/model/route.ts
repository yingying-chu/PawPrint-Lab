import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { twinJobs } from "@/db/schema";
import { getApiUser, unauthorized } from "@/lib/api-auth";

export const runtime = "edge";

/** Streams the owner's private GLB from R2. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const [job] = await getDb().select().from(twinJobs)
    .where(and(eq(twinJobs.id, id), eq(twinJobs.userId, user.userId)))
    .limit(1);
  const object = job?.modelR2Key ? await env.BUCKET?.get(job.modelR2Key) : null;
  if (!object) return Response.json({ error: "Model not found." }, { status: 404 });
  return new Response(object.body, {
    headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "private, max-age=3600" },
  });
}
