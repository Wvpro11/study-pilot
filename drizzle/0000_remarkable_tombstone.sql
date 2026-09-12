CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`course` text NOT NULL,
	`due_date` text NOT NULL,
	`estimated_minutes` integer DEFAULT 30 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_assignments_user_status_due` ON `assignments` (`user_id`,`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `planner_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`available_minutes` integer DEFAULT 120 NOT NULL,
	`session_minutes` integer DEFAULT 35 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
