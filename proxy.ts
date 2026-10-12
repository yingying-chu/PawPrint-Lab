import { NextResponse, type NextRequest } from "next/server";
import { demoAuth } from "@/lib/demo-auth";

// Signs visitors in to the shared demo account (see lib/demo-auth.ts) before the API routes run.
export async function proxy(request: NextRequest) {
  const authed = await demoAuth(request, {
    PAWPRINT_DEMO_OPEN: process.env.PAWPRINT_DEMO_OPEN,
    PAWPRINT_DEMO_PASSCODE: process.env.PAWPRINT_DEMO_PASSCODE,
  });
  if (authed instanceof Response) return authed;
  return NextResponse.next({ request: { headers: authed.headers } });
}

export const config = {
  matcher: ["/api/:path*", "/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"],
};
