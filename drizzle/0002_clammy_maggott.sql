CREATE TABLE `sharepoint_libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`drive_id` text NOT NULL,
	`name` text NOT NULL,
	`is_primary_for_cases` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sharepoint_libraries_drive_idx` ON `sharepoint_libraries` (`drive_id`);--> statement-breakpoint
ALTER TABLE `cases` ADD `sharepoint_library_id` text;--> statement-breakpoint
ALTER TABLE `sync_mappings` ADD `sharepoint_drive_id` text;--> statement-breakpoint
ALTER TABLE `webhook_subscriptions` ADD `sharepoint_drive_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_subscriptions_drive_idx` ON `webhook_subscriptions` (`sharepoint_drive_id`);