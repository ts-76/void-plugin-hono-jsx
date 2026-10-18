CREATE TABLE `isr_cases` (
	`path` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`fail` integer DEFAULT false NOT NULL,
	`privacy` text DEFAULT 'public' NOT NULL,
	`delay_ms` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `isr_renders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`version` integer NOT NULL,
	`viewer` text NOT NULL,
	`revision` text NOT NULL,
	`failed` integer NOT NULL
);
