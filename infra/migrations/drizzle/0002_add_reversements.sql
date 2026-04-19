CREATE TABLE `reversements` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL,
  `depositor_id` text NOT NULL,
  `period_start` integer NOT NULL,
  `period_end` integer NOT NULL,
  `total_sales` integer NOT NULL,
  `total_commission` integer NOT NULL,
  `total_reversement` integer NOT NULL,
  `status` text NOT NULL,
  `payment_method` text,
  `paid_at` integer,
  `paid_by` text,
  `notes` text,
  `created_at` integer NOT NULL
);

CREATE INDEX `idx_reversements_shop` ON `reversements` (`shop_id`);
CREATE INDEX `idx_reversements_depositor` ON `reversements` (`depositor_id`);
