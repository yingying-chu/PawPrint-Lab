CREATE TABLE `pet_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`user_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`status` text DEFAULT 'stored' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`delete_after` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_user_idx` ON `pet_photos` (`user_id`);--> statement-breakpoint
CREATE INDEX `photos_expiry_idx` ON `pet_photos` (`delete_after`);--> statement-breakpoint
CREATE TABLE `pets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pets_user_idx` ON `pets` (`user_id`);--> statement-breakpoint
CREATE TABLE `twin_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`user_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`provider` text DEFAULT 'meshy' NOT NULL,
	`provider_task_id` text,
	`status` text DEFAULT 'waiting_for_provider_key' NOT NULL,
	`model_r2_key` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_user_idx` ON `twin_jobs` (`user_id`);