-- CreateTable
CREATE TABLE IF NOT EXISTS "app_ratings" (
    "id"           BIGSERIAL NOT NULL,
    "user_id"      BIGINT NOT NULL,
    "stars"        SMALLINT NOT NULL,
    "category"     VARCHAR(30),
    "comment"      TEXT,
    "app_version"  VARCHAR(30),
    "device_os"    VARCHAR(30),
    "created_at"   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — one rating per user (upsert target, not a history table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_rating'
  ) THEN
    ALTER TABLE "app_ratings" ADD CONSTRAINT "unique_user_rating" UNIQUE ("user_id");
  END IF;
END $$;

-- CreateCheck
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_ratings_stars_check'
  ) THEN
    ALTER TABLE "app_ratings" ADD CONSTRAINT "app_ratings_stars_check" CHECK ("stars" BETWEEN 1 AND 5);
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_ratings_user_id_fkey'
  ) THEN
    ALTER TABLE "app_ratings"
      ADD CONSTRAINT "app_ratings_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
