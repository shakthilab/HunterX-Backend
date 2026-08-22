-- Automatic task-assignment system
--
-- 1. tasks: new columns the assignment engine reads to decide what to
--    assign a user on a given date.
-- 2. task_schedule: reshaped from a global (task_id, active_date) table
--    into a per-user assignment record (user_id, task_id, active_date).
--    Confirmed empty in production at the time of this migration, so this
--    is safe to reshape directly — no data-preserving backfill needed.
-- 3. task_admin_targets: new table for subset-targeting DAILY_ADMIN
--    one-off tasks. No rows for a task = it targets every active user.

-- 1. tasks: new columns
ALTER TABLE "tasks"
  ADD COLUMN "is_default_daily" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recurrence_days" INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN "scheduled_date" DATE;

-- 2. task_schedule: add user_id
ALTER TABLE "task_schedule"
  ADD COLUMN "user_id" BIGINT NOT NULL;

-- Drop whatever unique constraint currently enforces (task_id, active_date).
-- Its name may vary depending on how the table was originally created
-- (db push vs hand-written SQL), so find it by its columns instead of
-- hardcoding a guessed name.
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT tc.constraint_name INTO c_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'task_schedule'
    AND tc.constraint_type = 'UNIQUE'
  GROUP BY tc.constraint_name
  HAVING array_agg(kcu.column_name ORDER BY kcu.column_name) = ARRAY['active_date', 'task_id'];

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "task_schedule" DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE "task_schedule"
  ADD CONSTRAINT "task_schedule_user_id_task_id_active_date_key" UNIQUE ("user_id", "task_id", "active_date");

ALTER TABLE "task_schedule"
  ADD CONSTRAINT "task_schedule_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX "idx_task_schedule_user_date" ON "task_schedule"("user_id", "active_date");

-- 3. task_admin_targets
CREATE TABLE "task_admin_targets" (
  "id"         BIGSERIAL NOT NULL,
  "task_id"    BIGINT NOT NULL,
  "user_id"    BIGINT NOT NULL,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_admin_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_admin_targets_task_id_user_id_key" ON "task_admin_targets"("task_id", "user_id");
CREATE INDEX "idx_task_admin_targets_task" ON "task_admin_targets"("task_id");

ALTER TABLE "task_admin_targets"
  ADD CONSTRAINT "task_admin_targets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "task_admin_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
