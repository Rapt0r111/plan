ALTER TABLE `variable_leave_requests` ADD COLUMN `departure_time` text;
--> statement-breakpoint
ALTER TABLE `variable_leave_requests` ADD COLUMN `arrival_time` text;
--> statement-breakpoint
ALTER TABLE `variable_duty_assignments` ADD COLUMN `date_from` text;
--> statement-breakpoint
ALTER TABLE `variable_duty_assignments` ADD COLUMN `date_to` text;
--> statement-breakpoint
CREATE INDEX `variable_duty_assignments_range_idx` ON `variable_duty_assignments` (`date_from`,`date_to`);
