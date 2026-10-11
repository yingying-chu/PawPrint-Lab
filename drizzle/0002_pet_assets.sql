CREATE TABLE `pet_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pet_key` text NOT NULL,
	`pet_name` text NOT NULL,
	`kind` text DEFAULT 'sticker' NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`style` text NOT NULL,
	`photo_id` text,
	`provider` text DEFAULT 'meshy' NOT NULL,
	`provider_task_type` text NOT NULL,
	`provider_task_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`r2_key` text,
	`content_type` text,
	`arcade_reference_id` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pet_assets_user_pet_idx` ON `pet_assets` (`user_id`,`pet_key`);