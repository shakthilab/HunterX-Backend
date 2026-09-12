-- CreateTable
-- Daily health-metric summaries synced from the client's Apple HealthKit /
-- Google Health Connect reads, powering the Metrics screen's
-- Today/Week/Month/Year tabs. Purely a passive data store — nothing else
-- in this backend (task completion, XP, streaks) reads from or writes to
-- it; see health_metrics_daily in schema.prisma.
CREATE TABLE IF NOT EXISTS "health_metrics_daily" (
    "id"             BIGSERIAL NOT NULL,
    "user_id"        BIGINT NOT NULL,
    "date"           DATE NOT NULL,
    "steps"          INTEGER,
    "calories"       INTEGER,
    "distance_km"    NUMERIC(6,2),
    "active_minutes" INTEGER,
    "avg_heart_rate" INTEGER,
    "sleep_minutes"  INTEGER,
    "workout_count"  INTEGER,
    "source"         VARCHAR(20),
    "created_at"     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — one row per user per calendar day; re-syncing the same day
-- updates it instead of duplicating (upsert target for POST .../health-metrics)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_date'
  ) THEN
    ALTER TABLE "health_metrics_daily" ADD CONSTRAINT "unique_user_date" UNIQUE ("user_id", "date");
  END IF;
END $$;

-- CreateIndex — keeps range queries (week/month/year) fast as this table
-- grows across all users over time
CREATE INDEX IF NOT EXISTS "idx_health_metrics_daily_user_date" ON "health_metrics_daily"("user_id", "date");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'health_metrics_daily_user_id_fkey'
  ) THEN
    ALTER TABLE "health_metrics_daily"
      ADD CONSTRAINT "health_metrics_daily_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
