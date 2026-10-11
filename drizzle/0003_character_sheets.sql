ALTER TABLE `pet_assets` ADD `source_asset_id` text;--> statement-breakpoint
UPDATE `pet_assets` SET `kind` = 'character', `name` = REPLACE(`name`, 'Sticker ', 'Character ') WHERE `kind` = 'sticker';
