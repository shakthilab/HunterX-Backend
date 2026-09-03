-- AlterTable
ALTER TABLE "avatars" ADD COLUMN IF NOT EXISTS "gender" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'avatars_name_key'
  ) THEN
    ALTER TABLE "avatars" ADD CONSTRAINT "avatars_name_key" UNIQUE ("name");
  END IF;
END $$;
