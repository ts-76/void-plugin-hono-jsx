CREATE TABLE `rc_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`value` text NOT NULL,
	`transport` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);
