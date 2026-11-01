CREATE TABLE `damage_heads` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`label` text NOT NULL,
	`estimated_amount` real DEFAULT 0 NOT NULL,
	`proposed_amount` real,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `damage_heads_case_idx` ON `damage_heads` (`case_id`);--> statement-breakpoint
CREATE TABLE `medical_record_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`source_name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'requested' NOT NULL,
	`requested_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`reminders_sent_count` integer DEFAULT 0 NOT NULL,
	`last_reminder_at` text,
	`received_at` text,
	`sent_to_expert_at` text,
	`assigned_to_id` text,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `medical_record_requests_case_idx` ON `medical_record_requests` (`case_id`);--> statement-breakpoint
CREATE INDEX `medical_record_requests_status_idx` ON `medical_record_requests` (`status`);