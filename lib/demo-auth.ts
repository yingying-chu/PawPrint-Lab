// Pawprint demo sign-in, run by proxy.ts. The API routes read the signed-in user
// from oai-authenticated-user-* headers (the ChatGPT Sites convention); this sets
// them. With PAWPRINT_DEMO_OPEN=1 every visitor is the shared demo account;
// otherwise visitors who enter PAWPRINT_DEMO_PASSCODE are. Anyone else can still
// browse the shop.

export const DEMO_USER = { id: "local_seedy", email: "seedy@sites.test", fullName: "Seedy" };
export const AUTH_PATHS = new Set(["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"]);
const COOKIE = "__pawprint_demo";
const USER_HEADER_PREFIX = "oai-authenticated-user-";

export function passcodeForm(returnTo: string, wrong: boolean) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo sign-in · Pawprint Lab</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff4e6;color:#1f2440;font:15px system-ui,sans-serif}form{background:#fff8ee;border:2px solid #1f2440;border-radius:24px;padding:28px;width:min(380px,90vw);display:grid;gap:14px}h1{margin:0;font:600 26px Georgia,serif}p{margin:0;color:#474c66;line-height:1.5}input{border:1px solid rgba(31,36,64,.22);border-radius:12px;padding:13px 14px;font-size:15px}button{border:0;border-radius:999px;background:#ff6b3d;color:#fff;font-weight:700;padding:15px;font-size:15px;box-shadow:0 4px 0 #1f2440;cursor:pointer}.wrong{color:#a84428}</style></head>
<body><form method="get" action="/signin-with-chatgpt"><h1>Demo sign-in</h1><p>Enter the demo passcode to generate designs and save photos. Without it you can still browse the shop.</p>${wrong ? '<p class="wrong">That passcode didn’t match.</p>' : ""}<input name="code" autocomplete="off" placeholder="Passcode" required autofocus><input type="hidden" name="return_to" value="${escape(returnTo)}"><button>Sign in to the demo</button></form></body></html>`;
}

export function safeReturn(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost" || AUTH_PATHS.has(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

type DemoEnv = { PAWPRINT_DEMO_OPEN?: string; PAWPRINT_DEMO_PASSCODE?: string };

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The cookie holds a hash of the passcode, so changing the passcode signs everyone out.
const cookieToken = (passcode: string) => sha256(`pawprint-demo:${passcode}`);

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

/**
 * Handles the sign-in routes and stamps the demo user onto signed-in requests.
 * Returns a Response for the sign-in routes, otherwise the request to pass on.
 */
export async function demoAuth(request: Request, env: DemoEnv): Promise<Request | Response> {
  const url = new URL(request.url);
  const open = env.PAWPRINT_DEMO_OPEN === "1";
  const passcode = env.PAWPRINT_DEMO_PASSCODE?.trim() ?? "";
  const noStore = { "Cache-Control": "private, no-store" };

  if (AUTH_PATHS.has(url.pathname)) {
    if (url.pathname === "/callback") return new Response(null, { status: 501, headers: noStore });
    const signOut = url.pathname === "/signout-with-chatgpt";
    if (request.method !== "GET" && !(signOut && request.method === "POST")) {
      return new Response(null, { status: 405, headers: { ...noStore, Allow: signOut ? "GET, POST" : "GET" } });
    }
    const returnTo = safeReturn(url.searchParams.get("return_to"));
    let value = "";
    if (!signOut && !open) {
      const code = url.searchParams.get("code");
      if (!passcode || code === null || (await sha256(code)) !== (await sha256(passcode))) {
        return new Response(passcodeForm(returnTo, code !== null), {
          headers: { ...noStore, "Content-Type": "text/html; charset=utf-8" },
        });
      }
      value = await cookieToken(passcode);
    }
    return new Response(null, {
      status: request.method === "POST" ? 303 : 302,
      headers: {
        ...noStore,
        // Next.js proxy only accepts absolute redirect URLs.
        Location: new URL(returnTo, url).toString(),
        "Set-Cookie": `${COOKIE}=${value}; Path=/; ${signOut || !value ? "Max-Age=0; " : ""}HttpOnly; SameSite=Lax${url.protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  }

  // Never trust identity headers sent by the browser.
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.startsWith(USER_HEADER_PREFIX)) headers.delete(name);
  const cookie = readCookie(request, COOKIE);
  const signedIn = open || (Boolean(passcode) && Boolean(cookie) && cookie === (await cookieToken(passcode)));
  if (signedIn) {
    headers.set(`${USER_HEADER_PREFIX}id`, DEMO_USER.id);
    headers.set(`${USER_HEADER_PREFIX}email`, DEMO_USER.email);
    headers.set(`${USER_HEADER_PREFIX}full-name`, DEMO_USER.fullName);
    headers.set(`${USER_HEADER_PREFIX}full-name-encoding`, "percent-encoded-utf-8");
  }
  return new Request(request, { headers });
}
