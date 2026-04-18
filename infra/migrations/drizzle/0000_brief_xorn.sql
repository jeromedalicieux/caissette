CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text,
	`user_id` text,
	`event_type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`payload_json` text,
	`ip_address` text,
	`user_agent` text,
	`occurred_at` integer NOT NULL,
	`previous_hash` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_shop_date` ON `audit_log` (`shop_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `closures` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`type` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`sales_count` integer NOT NULL,
	`total_amount` integer NOT NULL,
	`total_vat` integer NOT NULL,
	`totals_by_payment_method_json` text,
	`totals_by_vat_rate_json` text,
	`first_receipt_number` integer,
	`last_receipt_number` integer,
	`previous_closure_hash` text,
	`hash` text NOT NULL,
	`signature` text NOT NULL,
	`generated_at` integer NOT NULL,
	`pdf_r2_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_closures_shop_type_period` ON `closures` (`shop_id`,`type`,`period_start`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`depositor_id` text NOT NULL,
	`number` text NOT NULL,
	`signed_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`commission_rate` integer NOT NULL,
	`status` text NOT NULL,
	`pdf_r2_key` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contracts_shop_number` ON `contracts` (`shop_id`,`number`);--> statement-breakpoint
CREATE TABLE `depositors` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`external_ref` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`id_document_type` text NOT NULL,
	`id_document_number` text NOT NULL,
	`birth_date` text,
	`iban` text,
	`default_commission_rate` integer,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_depositors_shop` ON `depositors` (`shop_id`);--> statement-breakpoint
CREATE INDEX `idx_depositors_name` ON `depositors` (`shop_id`,`last_name`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`contract_id` text,
	`depositor_id` text,
	`sku` text,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`brand` text,
	`size` text,
	`condition` text,
	`photos_r2_keys` text,
	`initial_price` integer NOT NULL,
	`current_price` integer NOT NULL,
	`cost_price` integer,
	`vat_regime` text NOT NULL,
	`vat_rate` integer NOT NULL,
	`status` text NOT NULL,
	`status_changed_at` integer NOT NULL,
	`entered_at` integer NOT NULL,
	`sold_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_items_shop_status` ON `items` (`shop_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_items_depositor` ON `items` (`depositor_id`);--> statement-breakpoint
CREATE INDEX `idx_items_contract` ON `items` (`contract_id`);--> statement-breakpoint
CREATE TABLE `police_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`entry_number` integer NOT NULL,
	`entry_type` text NOT NULL,
	`item_id` text,
	`depositor_id` text,
	`description` text NOT NULL,
	`depositor_name` text NOT NULL,
	`depositor_id_document` text NOT NULL,
	`sale_id` text,
	`exit_reason` text,
	`recorded_at` integer NOT NULL,
	`previous_hash` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_police_shop_entry` ON `police_ledger` (`shop_id`,`entry_number`);--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`scope` text NOT NULL,
	`scope_id` text,
	`step_days` integer NOT NULL,
	`discount_percent` integer NOT NULL,
	`max_steps` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`item_id` text,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`cost_basis` integer,
	`reversement_amount` integer,
	`depositor_id` text,
	`vat_regime` text NOT NULL,
	`vat_rate` integer NOT NULL,
	`vat_amount` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sale_items_sale` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_sale_items_depositor` ON `sale_items` (`depositor_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`receipt_number` integer NOT NULL,
	`cashier_id` text NOT NULL,
	`sold_at` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`total` integer NOT NULL,
	`vat_margin_amount` integer NOT NULL,
	`payment_method` text NOT NULL,
	`payment_details_json` text,
	`customer_note` text,
	`status` text NOT NULL,
	`previous_hash` text NOT NULL,
	`hash` text NOT NULL,
	`signed_server_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sales_shop_receipt` ON `sales` (`shop_id`,`receipt_number`);--> statement-breakpoint
CREATE INDEX `idx_sales_shop_date` ON `sales` (`shop_id`,`sold_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`siret` text NOT NULL,
	`vat_number` text,
	`vat_regime` text NOT NULL,
	`vat_declaration_regime` text DEFAULT 'simplified' NOT NULL,
	`address` text NOT NULL,
	`timezone` text DEFAULT 'Europe/Paris' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`settings_json` text,
	`subscription_tier` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`pin_hash` text,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_shop_email` ON `users` (`shop_id`,`email`);