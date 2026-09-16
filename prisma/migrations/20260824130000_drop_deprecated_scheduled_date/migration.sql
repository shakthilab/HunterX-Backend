-- Drop tasks.scheduled_date — deprecated when start_date/end_date
-- (20260824100000_task_date_windows) superseded it. Confirmed unused:
-- 0 of 3 existing tasks had a non-null value before this ran.

ALTER TABLE "tasks" DROP COLUMN "scheduled_date";
