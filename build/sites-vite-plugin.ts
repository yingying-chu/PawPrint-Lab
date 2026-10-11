// Vendored from @openai/sites-vite-plugin 0.2.0 (openai/sites#9).
// See sites-vite-plugin.LICENSE for the upstream MIT license.
import { timingSafeEqual } from "node:crypto";
import { access, cp, mkdir, rm } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const localUserId = "local_seedy";
const localEmail = "seedy@sites.test";
const localFullName = "Seedy";
const localCookieName = "__sites_local_auth";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const localAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
// Pawprint demo: with PAWPRINT_DEMO_OPEN=1 every visitor (localhost or a Cloudflare
// quick tunnel) uses the shared demo account, so no sign-in is needed. Otherwise only
// tunnel visitors who enter PAWPRINT_DEMO_PASSCODE are signed in. Both unset: the
// original local-only sign-in.
const isTunnelHost = (hostname: string) => hostname.endsWith(".trycloudflare.com");
const demoPasscode = () => process.env.PAWPRINT_DEMO_PASSCODE?.trim() || "";
const demoOpen = () => process.env.PAWPRINT_DEMO_OPEN === "1";
function passcodeMatches(code: string | null) {
  const expected = Buffer.from(demoPasscode());
  const given = Buffer.from(code ?? "");
  return expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}
function passcodeForm(returnTo: string, wrong: boolean) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo sign-in · Pawprint Lab</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff4e6;color:#1f2440;font:15px system-ui,sans-serif}form{background:#fff8ee;border:2px solid #1f2440;border-radius:24px;padding:28px;width:min(380px,90vw);display:grid;gap:14px}h1{margin:0;font:600 26px Georgia,serif}p{margin:0;color:#474c66;line-height:1.5}input{border:1px solid rgba(31,36,64,.22);border-radius:12px;padding:13px 14px;font-size:15px}button{border:0;border-radius:999px;background:#ff6b3d;color:#fff;font-weight:700;padding:15px;font-size:15px;box-shadow:0 4px 0 #1f2440;cursor:pointer}.wrong{color:#a84428}</style></head>
<body><form method="get" action="/signin-with-chatgpt"><h1>Demo sign-in</h1><p>Enter the demo passcode to generate designs and save photos. Without it you can still browse the shop.</p>${wrong ? '<p class="wrong">That passcode didn’t match.</p>' : ""}<input name="code" autocomplete="off" placeholder="Passcode" required autofocus><input type="hidden" name="return_to" value="${escape(returnTo)}"><button>Sign in to the demo</button></form></body></html>`;
}

const authPaths = new Set([
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/callback",
]);

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export function sites({ mockAuth = true } = {}): Plugin {
  let root = process.cwd();
  let command: "build" | "serve" = "build";

  return {
    name: "sites",
    configResolved(config) {
      root = config.root;
      command = config.command;
    },
    configureServer(server) {
      if (!mockAuth) return;
      const secure = Boolean(server.config.server.https);

      server.config.logger.info(`Sites local sign-in: ${localEmail}`);
      server.middlewares.use((request, response, next) => {
        for (const name of Object.keys(request.headers)) {
          if (name.startsWith("oai-authenticated-user-")) {
            removeHeader(request, name);
          }
        }

        let authority: URL;
        let url: URL;
        try {
          authority = new URL(
            `${secure ? "https" : "http"}://${request.headers.host}`,
          );
          url = new URL(request.url ?? "/", authority);
        } catch {
          if (authPaths.has((request.url ?? "/").split("?")[0])) {
            respond(response, 403);
          } else {
            next();
          }
          return;
        }

        const hostname = authority.hostname
          .replace(/^\[|\]$/g, "")
          .toLowerCase();
        // cloudflared forwards tunnel traffic from this machine, so it passes the address check.
        const demoHost = (demoOpen() || Boolean(demoPasscode())) && isTunnelHost(hostname);
        if (
          !(localHosts.has(hostname) || demoHost) ||
          !localAddresses.has(request.socket.remoteAddress ?? "") ||
          url.origin !== authority.origin
        ) {
          if (authPaths.has(url.pathname)) respond(response, 403);
          else next();
          return;
        }

        const cookies = (request.headers.cookie ?? "")
          .split(";")
          .map((cookie) => cookie.trim())
          .filter(Boolean);
        const signInCookies = cookies
          .filter((cookie) => cookie.startsWith(`${localCookieName}=`))
          .map((cookie) => cookie.slice(localCookieName.length + 1));
        const applicationCookies = cookies.filter(
          (cookie) => !cookie.startsWith(`${localCookieName}=`),
        );
        if (applicationCookies.length !== cookies.length) {
          removeHeader(request, "cookie");
          if (applicationCookies.length) {
            setHeader(request, "cookie", applicationCookies.join("; "));
          }
        }

        if (url.pathname === "/callback") {
          respond(response, 501);
          return;
        }

        const signIn = url.pathname === "/signin-with-chatgpt";
        const signOut = url.pathname === "/signout-with-chatgpt";
        if (!signIn && !signOut) {
          if ((signInCookies.length === 1 && signInCookies[0] === "1") || demoOpen()) {
            setHeader(request, "oai-authenticated-user-id", localUserId);
            setHeader(request, "oai-authenticated-user-email", localEmail);
            setHeader(
              request,
              "oai-authenticated-user-full-name",
              localFullName,
            );
            setHeader(
              request,
              "oai-authenticated-user-full-name-encoding",
              "percent-encoded-utf-8",
            );
          }
          next();
          return;
        }

        if (
          (request.headers.origin && request.headers.origin !== url.origin) ||
          request.headers["sec-fetch-site"] === "cross-site"
        ) {
          respond(response, 403);
          return;
        }

        if (
          request.headers["next-router-prefetch"] !== undefined ||
          request.headers["x-middleware-prefetch"] === "1" ||
          [request.headers.purpose, request.headers["sec-purpose"]].some(
            (value) =>
              typeof value === "string" &&
              value
                .split(/[;,]/)
                .some((part) => part.trim().toLowerCase() === "prefetch"),
          )
        ) {
          respond(response, 204);
          return;
        }

        if (
          request.method !== "GET" &&
          (!signOut || request.method !== "POST")
        ) {
          response.setHeader("Allow", signIn ? "GET" : "GET, POST");
          respond(response, 405);
          return;
        }

        if (signIn && demoHost && !demoOpen() && !passcodeMatches(url.searchParams.get("code"))) {
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.setHeader("Cache-Control", "private, no-store");
          response.end(passcodeForm(safeReturn(url.searchParams.get("return_to")), url.searchParams.has("code")));
          return;
        }

        response.statusCode = request.method === "POST" ? 303 : 302;
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader(
          "Location",
          safeReturn(url.searchParams.get("return_to")),
        );
        response.setHeader(
          "Set-Cookie",
          `${localCookieName}=${signIn ? "1" : ""}; Path=/; ${
            signOut ? "Max-Age=0; " : ""
          }HttpOnly; SameSite=Lax${secure || demoHost ? "; Secure" : ""}`,
        );
        response.end();
      });
    },
    async closeBundle() {
      if (command !== "build") return;

      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}

function removeHeader(request: IncomingMessage, name: string): void {
  delete request.headers[name];
  for (let index = request.rawHeaders.length - 2; index >= 0; index -= 2) {
    if (request.rawHeaders[index]?.toLowerCase() === name) {
      request.rawHeaders.splice(index, 2);
    }
  }
}

function setHeader(
  request: IncomingMessage,
  name: string,
  value: string,
): void {
  removeHeader(request, name);
  request.headers[name] = value;
  request.rawHeaders.push(name, value);
}

function respond(response: ServerResponse, status: number): void {
  response.statusCode = status;
  response.setHeader("Cache-Control", "private, no-store");
  response.end();
}

function safeReturn(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost" || authPaths.has(url.pathname)) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
