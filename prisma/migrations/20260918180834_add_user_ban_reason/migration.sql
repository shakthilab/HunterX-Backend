-- DropIndex
DROP INDEX "idx_feedback_user_created";

-- AlterTable
ALTER TABLE "app_ratings" ALTER COLUMN "created_at" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "feedback" ALTER COLUMN "created_at" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ban_reason" VARCHAR(255);

-- CreateIndex
CREATE INDEX "idx_feedback_user_created" ON "feedback"("user_id", "created_at");
