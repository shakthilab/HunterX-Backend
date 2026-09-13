-- AlterTable
-- Personalized daily water/steps targets, replacing the old fixed "3L
-- Water" task and backing a new "Daily Steps" task — see
-- src/utils/helpers.js#calculateWaterGoal / #calculateStepsGoal.
ALTER TABLE "users" ADD COLUMN     "daily_water_goal" DOUBLE PRECISION,
ADD COLUMN     "daily_steps_goal" INTEGER;
