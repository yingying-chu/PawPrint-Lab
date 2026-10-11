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
  // Set once the owner opts in to sharing this photo with Arcade as a design reference.
  arcadeReferenceId: text("arcade_reference_id"),
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

export const designs = sqliteTable("designs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  // Client-side pet profile id; pets only get a server row once a photo is uploaded.
  petKey: text("pet_key").notNull(),
  petName: text("pet_name").notNull(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  style: text("style").notNull(),
  colors: text("colors").notNull().default("[]"),
  photoId: text("photo_id"),
  arcadeJobId: text("arcade_job_id"),
  patternId: text("pattern_id"),
  status: text("status").notNull().default("running"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("designs_user_pet_idx").on(table.userId, table.petKey)]);

export const arcadeProducts = sqliteTable("arcade_products", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  designId: text("design_id").notNull(),
  categoryId: text("category_id").notNull(),
  categoryName: text("category_name").notNull(),
  arcadeJobId: text("arcade_job_id"),
  productId: text("product_id"),
  status: text("status").notNull().default("running"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("arcade_products_design_idx").on(table.userId, table.designId)]);
