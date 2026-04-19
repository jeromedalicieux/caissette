-- Fix sessions table: add missing shop_id and created_at columns
-- Sessions are ephemeral — safe to drop and recreate
DROP TABLE IF EXISTS `sessions`;
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
