-- CreateTable
CREATE TABLE IF NOT EXISTS "feedback" (
    "id"             BIGSERIAL NOT NULL,
    "user_id"        BIGINT,
    "category"       VARCHAR(30) NOT NULL,
    "message"        TEXT NOT NULL,
    "attachment_url" VARCHAR(500),
    "allow_followup" BOOLEAN NOT NULL DEFAULT true,
    "status"         VARCHAR(20) NOT NULL DEFAULT 'received',
    "app_version"    VARCHAR(30),
    "device_os"      VARCHAR(30),
    "user_level"     INT,
    "created_at"     TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — a user's own feedback history, newest first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_feedback_user_created'
  ) THEN
    CREATE INDEX "idx_feedback_user_created" ON "feedback" ("user_id", "created_at" DESC);
  END IF;
END $$;

-- CreateCheck
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_category_check'
  ) THEN
    ALTER TABLE "feedback" ADD CONSTRAINT "feedback_category_check"
      CHECK ("category" IN ('bug_report', 'suggestion', 'other'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_status_check'
  ) THEN
    ALTER TABLE "feedback" ADD CONSTRAINT "feedback_status_check"
      CHECK ("status" IN ('received', 'in_review', 'resolved'));
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_user_id_fkey'
  ) THEN
    ALTER TABLE "feedback"
      ADD CONSTRAINT "feedback_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
