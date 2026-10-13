CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`fixture_id` text,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`at` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`before` text,
	`after` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_tournament` ON `audit` (`tournament_id`);--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`home` text NOT NULL,
	`away` text NOT NULL,
	`stage` text NOT NULL,
	`matchday` integer NOT NULL,
	`scheduled` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`report` text,
	`submitted_by` text,
	`submitted_manager` text,
	`submitted_at` text,
	`finalized_at` text,
	`note` text,
	`version` integer DEFAULT 0 NOT NULL,
	`mutation` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fixture_tournament` ON `fixtures` (`tournament_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fixture_pair` ON `fixtures` (`tournament_id`,`stage`,`matchday`,`home`,`away`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`manager_id` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_email` ON `members` (`tournament_id`,`email`);--> statement-breakpoint
CREATE INDEX `member_user` ON `members` (`user_id`);--> statement-breakpoint
CREATE TABLE `proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`fixture_id` text NOT NULL,
	`uploader` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`key` text NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `proof_fixture` ON `proofs` (`fixture_id`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`config` text NOT NULL,
	`created_at` text NOT NULL,
	`awards` text,
	`locked_at` text,
	`revision` integer DEFAULT 0 NOT NULL
);
