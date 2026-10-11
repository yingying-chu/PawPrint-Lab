import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pets = sqliteTable("pets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("pets_user_idx").on(table.userId)]);

export const petPhotos = sqliteTable("pet_photos", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull(),
  userId: text("user_id").notNull(),
  r2Key: text("r2_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  status: text("status").notNull().default("stored"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deleteAfter: text("delete_after").notNull(),
}, (table) => [index("photos_user_idx").on(table.userId), index("photos_expiry_idx").on(table.deleteAfter)]);

export const twinJobs = sqliteTable("twin_jobs", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull(),
  userId: text("user_id").notNull(),
  photoId: text("photo_id").notNull(),
  provider: text("provider").notNull().default("meshy"),
  providerTaskId: text("provider_task_id"),
  status: text("status").notNull().default("waiting_for_provider_key"),
  modelR2Key: text("model_r2_key"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("jobs_user_idx").on(table.userId)]);
