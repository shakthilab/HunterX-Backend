-- Date-window support for admin-created tasks (DAILY_ADMIN / WEEKLY)
--
-- Lets admins schedule a task for a future date and choose whether it's
-- one-time or recurring, instead of only "exactly today, one-off"
-- (the old scheduled_date column, now deprecated and left unused).
--
--   start_date — first date the task is assignable (can be in the future)
--   end_date   — last date the task is assignable:
--     is_recurring=false + DAILY_ADMIN -> end_date = start_date (single day)
--     is_recurring=false + WEEKLY      -> end_date = start_date + 6 (one 7-day window)
--     is_recurring=true                -> admin-set, required, >= start_date
--       (WEEKLY additionally requires >= start_date + 6, i.e. at least one
--       full week)
--
-- taskAssignmentService then assigns a task on date D whenever
-- start_date <= D <= end_date (plus, for WEEKLY, D's weekday is in
-- recurrence_days) — one range check covers one-time and recurring alike.
--
-- Nullable at the DB level: DAILY_FIXED routine tasks (is_default_daily)
-- don't use this window at all and leave both columns null.

ALTER TABLE "tasks"
  ADD COLUMN "start_date" DATE,
  ADD COLUMN "end_date"   DATE;

CREATE INDEX "idx_tasks_type_active_window" ON "tasks"("task_type", "is_active", "start_date", "end_date");
