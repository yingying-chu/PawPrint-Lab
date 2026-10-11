CREATE TABLE `arcade_products` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`design_id` text NOT NULL,
	`category_id` text NOT NULL,
	`category_name` text NOT NULL,
	`arcade_job_id` text,
	`product_id` text,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `arcade_products_design_idx` ON `arcade_products` (`user_id`,`design_id`);--> statement-breakpoint
CREATE TABLE `designs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pet_key` text NOT NULL,
	`pet_name` text NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`style` text NOT NULL,
	`colors` text DEFAULT '[]' NOT NULL,
	`photo_id` text,
	`arcade_job_id` text,
	`pattern_id` text,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `designs_user_pet_idx` ON `designs` (`user_id`,`pet_key`);--> statement-breakpoint
ALTER TABLE `pet_photos` ADD `arcade_reference_id` text;