CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text,
	`actor_label` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`details` text,
	`ip_address` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_log_employee_idx` ON `audit_log` (`employee_id`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `case_parties` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`role` text NOT NULL,
	`full_name` text NOT NULL,
	`id_number` text,
	`address` text,
	`phone` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `case_parties_case_idx` ON `case_parties` (`case_id`);--> statement-breakpoint
CREATE TABLE `case_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`folder_template` text NOT NULL,
	`task_template` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`case_number` text NOT NULL,
	`title` text NOT NULL,
	`case_type_id` text,
	`client_id` text NOT NULL,
	`court_case_number` text,
	`opposing_party` text,
	`status` text DEFAULT 'open' NOT NULL,
	`responsible_employee_id` text,
	`folder_path` text NOT NULL,
	`sharepoint_folder_item_id` text,
	`drive_folder_id` text,
	`notes` text,
	`opened_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`closed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`case_type_id`) REFERENCES `case_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responsible_employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cases_case_number_unique` ON `cases` (`case_number`);--> statement-breakpoint
CREATE INDEX `cases_client_idx` ON `cases` (`client_id`);--> statement-breakpoint
CREATE INDEX `cases_status_idx` ON `cases` (`status`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`id_number` text,
	`phone` text,
	`email` text,
	`address` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`docx_base64` text NOT NULL,
	`placeholders` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`name` text NOT NULL,
	`relative_path` text NOT NULL,
	`primary_provider` text DEFAULT 'sharepoint' NOT NULL,
	`sharepoint_item_id` text,
	`sharepoint_etag` text,
	`drive_file_id` text,
	`drive_md5` text,
	`content_hash` text,
	`mime_type` text,
	`size_bytes` integer,
	`source` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_employee_id` text,
	`last_modified_by_employee_id` text,
	`last_modified_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_modified_by_employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `documents_case_idx` ON `documents` (`case_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_sharepoint_item_idx` ON `documents` (`sharepoint_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_drive_file_idx` ON `documents` (`drive_file_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'associate' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'ILS' NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `financial_transactions_case_idx` ON `financial_transactions` (`case_id`);--> statement-breakpoint
CREATE TABLE `gov_case_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`payload` text,
	`received_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_case_updates_case_idx` ON `gov_case_updates` (`case_id`);--> statement-breakpoint
CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_mapping_id` text NOT NULL,
	`description` text NOT NULL,
	`sharepoint_hash_at_conflict` text,
	`drive_hash_at_conflict` text,
	`resolution` text,
	`resolved_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`sync_mapping_id`) REFERENCES `sync_mappings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_conflicts_mapping_idx` ON `sync_conflicts` (`sync_mapping_id`);--> statement-breakpoint
CREATE TABLE `sync_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`item_type` text NOT NULL,
	`relative_path` text NOT NULL,
	`sharepoint_item_id` text,
	`sharepoint_etag` text,
	`sharepoint_hash` text,
	`drive_file_id` text,
	`drive_md5` text,
	`last_synced_at` text,
	`last_sync_direction` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_mappings_path_idx` ON `sync_mappings` (`relative_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `sync_mappings_sp_item_idx` ON `sync_mappings` (`sharepoint_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sync_mappings_drive_file_idx` ON `sync_mappings` (`drive_file_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text,
	`title` text NOT NULL,
	`description` text,
	`due_date` text,
	`assigned_to_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_case_idx` ON `tasks` (`case_id`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assigned_to_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE TABLE `user_identity_map` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`ms_user_id` text,
	`ms_user_principal_name` text,
	`google_user_id` text,
	`google_email` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_identity_employee_idx` ON `user_identity_map` (`employee_id`);--> statement-breakpoint
CREATE INDEX `user_identity_ms_idx` ON `user_identity_map` (`ms_user_id`);--> statement-breakpoint
CREATE INDEX `user_identity_google_idx` ON `user_identity_map` (`google_user_id`);--> statement-breakpoint
CREATE TABLE `webhook_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`subscription_id` text NOT NULL,
	`resource_uri` text NOT NULL,
	`drive_resource_id` text,
	`expiration_date_time` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
