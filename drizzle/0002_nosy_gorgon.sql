CREATE INDEX `subtasks_task_id_idx` ON `subtasks` (`task_id`);--> statement-breakpoint
CREATE INDEX `ta_task_id_idx` ON `task_assignees` (`task_id`);--> statement-breakpoint
CREATE INDEX `ta_user_id_idx` ON `task_assignees` (`user_id`);--> statement-breakpoint
CREATE INDEX `tasks_epic_id_idx` ON `tasks` (`epic_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_priority_idx` ON `tasks` (`priority`);--> statement-breakpoint
CREATE INDEX `tasks_epic_status_idx` ON `tasks` (`epic_id`,`status`);