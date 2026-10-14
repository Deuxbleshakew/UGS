CREATE TABLE `community_players` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_player_owner` ON `community_players` (`owner_id`);--> statement-breakpoint
CREATE TABLE `player_links` (
	`tournament_id` text NOT NULL,
	`manager_id` text NOT NULL,
	`player_id` text NOT NULL,
	PRIMARY KEY(`tournament_id`, `manager_id`),
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `community_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `playoff_ties` (
	`id` text PRIMARY KEY NOT NULL,
	`playoff_id` text NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`player_a` text NOT NULL,
	`player_b` text,
	FOREIGN KEY (`playoff_id`) REFERENCES `playoffs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_a`) REFERENCES `community_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_b`) REFERENCES `community_players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "playoff_distinct_players" CHECK("playoff_ties"."player_b" IS NULL OR "playoff_ties"."player_a" <> "playoff_ties"."player_b")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playoff_tie_position` ON `playoff_ties` (`playoff_id`,`round`,`position`);--> statement-breakpoint
CREATE TABLE `playoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`target` integer NOT NULL,
	`elo_mode` text NOT NULL,
	`draw_seed` text NOT NULL,
	`entrants` text NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`qualified` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "playoff_target" CHECK("playoffs"."target" >= 1),
	CONSTRAINT "playoff_elo_mode" CHECK("playoffs"."elo_mode" IN ('match','tie'))
);
--> statement-breakpoint
CREATE INDEX `playoff_tournament` ON `playoffs` (`tournament_id`);--> statement-breakpoint
DROP INDEX `fixture_pair`;--> statement-breakpoint
ALTER TABLE `fixtures` ADD `kind` text DEFAULT 'club' NOT NULL;--> statement-breakpoint
ALTER TABLE `fixtures` ADD `home_player_id` text REFERENCES community_players(id);--> statement-breakpoint
ALTER TABLE `fixtures` ADD `away_player_id` text REFERENCES community_players(id);--> statement-breakpoint
ALTER TABLE `fixtures` ADD `tie_id` text REFERENCES playoff_ties(id);--> statement-breakpoint
ALTER TABLE `fixtures` ADD `leg` integer;--> statement-breakpoint
ALTER TABLE `fixtures` ADD `playoff_round` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `fixture_tie_leg` ON `fixtures` (`tie_id`,`leg`);--> statement-breakpoint
CREATE INDEX `fixture_rating` ON `fixtures` (`status`,`home_player_id`,`away_player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fixture_pair` ON `fixtures` (`tournament_id`,`stage`,`matchday`,`home`,`away`) WHERE "fixtures"."kind" = 'club';--> statement-breakpoint
ALTER TABLE `members` ADD `player_id` text REFERENCES community_players(id);--> statement-breakpoint
CREATE UNIQUE INDEX `member_player` ON `members` (`tournament_id`,`player_id`);