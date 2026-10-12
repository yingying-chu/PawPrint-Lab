import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const LOCAL_DATABASE_URL = "file:.data/pawprint.db";

/** Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN) when deployed; a local SQLite file in dev. */
export function databaseConfig() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return { url, authToken: process.env.TURSO_AUTH_TOKEN };
  if (process.env.VERCEL) {
    throw new Error("TURSO_DATABASE_URL is not set. Connect a Turso database to this Vercel project.");
  }
  mkdirSync(".data", { recursive: true });
  return { url: LOCAL_DATABASE_URL };
}

let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  db ??= drizzle(createClient(databaseConfig()), { schema });
  return db;
}
