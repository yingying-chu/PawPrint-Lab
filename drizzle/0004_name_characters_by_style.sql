-- Characters were numbered ("Character 1"); name them by style and pet instead.
UPDATE `pet_assets`
SET `name` = CASE `style` WHEN 'cutout' THEN 'Paper-cut ' WHEN 'minimal' THEN 'Minimal ' ELSE 'Storybook ' END || `pet_name`
WHERE `kind` = 'character' AND `name` LIKE 'Character %';
