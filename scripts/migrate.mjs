// Applies the drizzle/ migrations: to Turso when TURSO_DATABASE_URL is set
// (Vercel runs this before every build), otherwise to the local .data/pawprint.db.
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL;
if (!url && process.env.VERCEL) {
  console.error("TURSO_DATABASE_URL is not set. Connect a Turso database to this Vercel project.");
  process.exit(1);
}
if (!url) mkdirSync(".data", { recursive: true });
const client = createClient(url ? { url, authToken: process.env.TURSO_AUTH_TOKEN } : { url: "file:.data/pawprint.db" });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
client.close();
console.log(`Database migrations applied (${url ? "Turso" : "local .data/pawprint.db"}).`);
