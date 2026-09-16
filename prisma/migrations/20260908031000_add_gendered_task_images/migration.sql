-- AlterTable
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "image_url_male" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "image_url_female" VARCHAR(500);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "units" VARCHAR(10) NOT NULL DEFAULT 'metric',
    "notify_all" BOOLEAN NOT NULL DEFAULT true,
    "notify_daily_motivation" BOOLEAN NOT NULL DEFAULT true,
    "notify_task_reminders" BOOLEAN NOT NULL DEFAULT true,
    "notify_streak_preservation" BOOLEAN NOT NULL DEFAULT true,
    "notify_streak_milestones" BOOLEAN NOT NULL DEFAULT true,
    "notify_streak_freeze" BOOLEAN NOT NULL DEFAULT true,
    "notify_level_up" BOOLEAN NOT NULL DEFAULT true,
    "notify_reward_ready" BOOLEAN NOT NULL DEFAULT true,
    "notify_announcements" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id")
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_fkey'
  ) THEN
    ALTER TABLE "user_settings"
      ADD CONSTRAINT "user_settings_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
