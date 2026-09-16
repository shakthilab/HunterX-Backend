-- Baseline schema migration.
--
-- Root cause of the P3018/P3009 failure on fresh databases: this repo's
-- tables (users, tasks, task_schedule, etc.) were originally created via
-- `prisma db push` against a shared dev/staging database, never through a
-- tracked migration. The first migration ever committed here
-- (20260822120000_task_assignment_system) already assumes "tasks",
-- "task_schedule", and "users" exist — fine against that pre-existing
-- populated database, but fatal against a brand-new empty one (e.g. a
-- fresh Railway Postgres), which has no tables at all yet.
--
-- This migration backfills that missing baseline: it creates every table
-- exactly as it stood immediately before 20260822120000_task_assignment_system
-- was authored, reconstructed from prisma/schema.prisma as of commit
-- 58a3041 (the parent of the commit that introduced that migration) via
--   npx prisma migrate diff --from-empty --to-schema <historical schema.prisma> --script
--
-- On a fresh database this runs first (timestamp sorts before
-- 20260822120000) and creates everything the later migrations expect.
--
-- On any database that already has these tables from the old `db push`
-- workflow (local dev, any already-provisioned environment), this
-- migration must be marked as already applied without running it:
--   npx prisma migrate resolve --applied 20260822115959_baseline_schema
-- Do NOT run `prisma migrate deploy` against such a database before doing
-- that, or it will try to CREATE TABLE over tables that already exist.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "auth_provider_type" AS ENUM ('EMAIL', 'GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "badge_type" AS ENUM ('LEVEL', 'STREAK', 'ACHIEVEMENT', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "completion_status" AS ENUM ('COMPLETED', 'SKIPPED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "fcm_platform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "fitness_level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "health_source" AS ENUM ('APPLE_HEALTH', 'GOOGLE_FIT', 'MANUAL');

-- CreateEnum
CREATE TYPE "level_target" AS ENUM ('ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('PENDING', 'MATCHED', 'UNMATCHED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "milestone_reward_type" AS ENUM ('COUPON', 'BADGE', 'XP_BONUS');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('DAILY_MOTIVATION', 'STREAK_AT_RISK', 'TASK_REMINDER', 'STREAK_MILESTONE', 'LEVEL_UP', 'REWARD_READY', 'STREAK_FREEZE_USED', 'STREAK_BROKEN', 'MONTHLY_FREEZE', 'BROADCAST');

-- CreateEnum
CREATE TYPE "reward_status" AS ENUM ('ACTIVE', 'CLAIMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "reward_trigger" AS ENUM ('STREAK_7', 'STREAK_14', 'STREAK_21', 'STREAK_30', 'STREAK_60', 'STREAK_90', 'LEVEL_UP', 'REFERRAL', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "subscription_platform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'TRIAL');

-- CreateEnum
CREATE TYPE "swipe_direction" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "task_schedule_status" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "task_type" AS ENUM ('DAILY_FIXED', 'DAILY_ADMIN', 'WEEKLY');

-- CreateEnum
CREATE TYPE "user_gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "auth_providers" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "provider" "auth_provider_type" NOT NULL,
    "provider_id" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatars" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "unlock_at_level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "image_url" VARCHAR(500),
    "badge_type" "badge_type" NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" BIGSERIAL NOT NULL,
    "season_id" BIGINT,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "reward_badge_id" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_interests" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(100),

    CONSTRAINT "discovery_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_matches" (
    "id" BIGSERIAL NOT NULL,
    "user_a_id" BIGINT NOT NULL,
    "user_b_id" BIGINT NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'MATCHED',
    "matched_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "unmatched_at" TIMESTAMP(6),
    "unmatched_by" BIGINT,

    CONSTRAINT "discovery_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_swipes" (
    "id" BIGSERIAL NOT NULL,
    "swiper_id" BIGINT NOT NULL,
    "swiped_id" BIGINT NOT NULL,
    "direction" "swipe_direction" NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_swipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dragon_stages" (
    "id" BIGSERIAL NOT NULL,
    "stage_number" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rank_name" VARCHAR(100) NOT NULL,
    "lore" TEXT NOT NULL,
    "unlock_message" TEXT NOT NULL,
    "level_range_start" INTEGER NOT NULL,
    "level_range_end" INTEGER NOT NULL,
    "primary_color" VARCHAR(7) NOT NULL,
    "glow_color" VARCHAR(7) NOT NULL,
    "idle_animation" VARCHAR(200),
    "levelup_animation" VARCHAR(200),
    "evolution_animation" VARCHAR(200),
    "thumbnail_url" VARCHAR(500),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dragon_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_metrics" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "metric_date" DATE NOT NULL,
    "steps" INTEGER,
    "distance_km" DOUBLE PRECISION,
    "heart_rate_avg" INTEGER,
    "heart_rate_max" INTEGER,
    "calories" INTEGER,
    "sleep_hours" DOUBLE PRECISION,
    "active_minutes" INTEGER,
    "source" "health_source" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "season_id" BIGINT,
    "weekly_xp" INTEGER NOT NULL DEFAULT 0,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "global_rank" INTEGER,
    "previous_rank" INTEGER,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" BIGSERIAL NOT NULL,
    "level_number" INTEGER NOT NULL,
    "xp_required" INTEGER NOT NULL,
    "badge_id" BIGINT,
    "title" VARCHAR(100),
    "rank_name" VARCHAR(100),
    "unlock_message" TEXT,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "message_status" NOT NULL DEFAULT 'SENT',
    "sent_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" VARCHAR(500),
    "data" JSONB,
    "quote_id" BIGINT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" BIGSERIAL NOT NULL,
    "quote_text" TEXT NOT NULL,
    "author_name" VARCHAR(255) NOT NULL,
    "author_image_url" VARCHAR(500),
    "category" VARCHAR(100),
    "source" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" BIGSERIAL NOT NULL,
    "referrer_id" BIGINT NOT NULL,
    "referred_id" BIGINT NOT NULL,
    "xp_awarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_partners" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "logo_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_pool" (
    "id" BIGSERIAL NOT NULL,
    "partner_id" BIGINT NOT NULL,
    "coupon_code" VARCHAR(50) NOT NULL,
    "discount_value" VARCHAR(100),
    "description" VARCHAR(500),
    "expires_at" TIMESTAMP(6),
    "is_assigned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_milestones" (
    "id" BIGSERIAL NOT NULL,
    "streak_days" INTEGER NOT NULL,
    "reward_type" "milestone_reward_type" NOT NULL,
    "xp_bonus" INTEGER DEFAULT 0,
    "description" VARCHAR(500),

    CONSTRAINT "streak_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'monthly',
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "platform" "subscription_platform" NOT NULL,
    "receipt_data" TEXT,
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "cancelled_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "task_id" BIGINT NOT NULL,
    "schedule_date" DATE NOT NULL,
    "status" "completion_status" NOT NULL DEFAULT 'COMPLETED',
    "progress_value" DOUBLE PRECISION,
    "xp_earned" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_schedule" (
    "id" BIGSERIAL NOT NULL,
    "task_id" BIGINT NOT NULL,
    "active_date" DATE NOT NULL,
    "status" "task_schedule_status" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "tag" VARCHAR(100),
    "image_url" VARCHAR(500),
    "task_type" "task_type" NOT NULL,
    "xp_reward" INTEGER NOT NULL DEFAULT 50,
    "xp_partial" INTEGER NOT NULL DEFAULT 25,
    "allows_partial" BOOLEAN NOT NULL DEFAULT false,
    "target_value" DOUBLE PRECISION,
    "target_unit" VARCHAR(50),
    "level_target" "level_target" NOT NULL DEFAULT 'ALL',
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "badge_id" BIGINT NOT NULL,
    "earned_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_discovery_interests" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "interest_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_discovery_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_dragon_evolutions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "stage_number" INTEGER NOT NULL,
    "level_at_evolution" INTEGER NOT NULL,
    "evolved_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_dragon_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_fcm_tokens" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "platform" "fcm_platform" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_onboarding_answers" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_onboarding_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progression" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "daily_streak" INTEGER NOT NULL DEFAULT 0,
    "weekly_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "streak_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "consecutive_miss_days" INTEGER NOT NULL DEFAULT 0,
    "last_active_date" DATE,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_progression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_rewards" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "pool_id" BIGINT NOT NULL,
    "trigger_type" "reward_trigger" NOT NULL,
    "status" "reward_status" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),

    CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streak_milestones" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "milestone_id" BIGINT NOT NULL,
    "streak_days" INTEGER NOT NULL,
    "awarded_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_streak_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "hunter_id" VARCHAR(12) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "avatar_id" BIGINT,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "onboarding_done" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_step" INTEGER NOT NULL DEFAULT 0,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "referral_code" VARCHAR(8) NOT NULL,
    "referred_by" BIGINT,
    "gender" "user_gender",
    "date_of_birth" DATE,
    "height_cm" DOUBLE PRECISION,
    "weight_kg" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "daily_protein_goal" DOUBLE PRECISION,
    "fitness_level" "fitness_level" NOT NULL DEFAULT 'BEGINNER',
    "dragon_stage" INTEGER NOT NULL DEFAULT 1,
    "streak_freeze_available" BOOLEAN NOT NULL DEFAULT false,
    "streak_freeze_used_this_month" BOOLEAN NOT NULL DEFAULT false,
    "last_latitude" DOUBLE PRECISION,
    "last_longitude" DOUBLE PRECISION,
    "location_updated_at" TIMESTAMP(6),
    "location_visible" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" VARCHAR(255),
    "reset_token" VARCHAR(255),
    "reset_token_expiry" TIMESTAMP(6),
    "oath_accepted" BOOLEAN NOT NULL DEFAULT false,
    "oath_accepted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_transactions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "task_id" BIGINT,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_otps" (
    "id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_auth_providers_user" ON "auth_providers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_provider_provider_id_key" ON "auth_providers"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_interests_name_key" ON "discovery_interests"("name");

-- CreateIndex
CREATE INDEX "idx_matches_user_a" ON "discovery_matches"("user_a_id");

-- CreateIndex
CREATE INDEX "idx_matches_user_b" ON "discovery_matches"("user_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_matches_user_a_id_user_b_id_key" ON "discovery_matches"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "idx_swipes_swiped" ON "discovery_swipes"("swiped_id");

-- CreateIndex
CREATE INDEX "idx_swipes_swiper" ON "discovery_swipes"("swiper_id");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_swipes_swiper_id_swiped_id_key" ON "discovery_swipes"("swiper_id", "swiped_id");

-- CreateIndex
CREATE UNIQUE INDEX "dragon_stages_stage_number_key" ON "dragon_stages"("stage_number");

-- CreateIndex
CREATE INDEX "idx_dragon_stage_number" ON "dragon_stages"("stage_number");

-- CreateIndex
CREATE INDEX "idx_health_user_date" ON "health_metrics"("user_id", "metric_date");

-- CreateIndex
CREATE UNIQUE INDEX "health_metrics_user_id_metric_date_source_key" ON "health_metrics"("user_id", "metric_date", "source");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_user_id_key" ON "leaderboard"("user_id");

-- CreateIndex
CREATE INDEX "idx_leaderboard_season" ON "leaderboard"("season_id");

-- CreateIndex
CREATE INDEX "idx_leaderboard_total" ON "leaderboard"("total_xp" DESC);

-- CreateIndex
CREATE INDEX "idx_leaderboard_weekly" ON "leaderboard"("weekly_xp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "levels_level_number_key" ON "levels"("level_number");

-- CreateIndex
CREATE INDEX "idx_messages_match" ON "messages"("match_id", "sent_at");

-- CreateIndex
CREATE INDEX "idx_notifications_sent" ON "notifications"("sent_at");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrer_id_referred_id_key" ON "referrals"("referrer_id", "referred_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_pool_coupon_code_key" ON "reward_pool"("coupon_code");

-- CreateIndex
CREATE UNIQUE INDEX "streak_milestones_streak_days_key" ON "streak_milestones"("streak_days");

-- CreateIndex
CREATE INDEX "idx_subscriptions_expires" ON "subscriptions"("expires_at") WHERE (status = 'ACTIVE'::subscription_status);

-- CreateIndex
CREATE INDEX "idx_subscriptions_user" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_completions_task_date" ON "task_completions"("task_id", "schedule_date");

-- CreateIndex
CREATE INDEX "idx_completions_user_date" ON "task_completions"("user_id", "schedule_date");

-- CreateIndex
CREATE UNIQUE INDEX "task_completions_user_id_task_id_schedule_date_key" ON "task_completions"("user_id", "task_id", "schedule_date");

-- CreateIndex
CREATE INDEX "idx_task_schedule_date" ON "task_schedule"("active_date", "status");

-- CreateIndex
CREATE INDEX "idx_task_schedule_task" ON "task_schedule"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_schedule_task_id_active_date_key" ON "task_schedule"("task_id", "active_date");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_discovery_interests_user_id_interest_id_key" ON "user_discovery_interests"("user_id", "interest_id");

-- CreateIndex
CREATE INDEX "idx_dragon_evolutions_user" ON "user_dragon_evolutions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_dragon_evolutions_user_id_stage_number_key" ON "user_dragon_evolutions"("user_id", "stage_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_fcm_tokens_user_id_platform_key" ON "user_fcm_tokens"("user_id", "platform");

-- CreateIndex
CREATE INDEX "idx_onboarding_answers_user" ON "user_onboarding_answers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_onboarding_answers_user_id_question_id_key" ON "user_onboarding_answers"("user_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_progression_user_id_key" ON "user_progression"("user_id");

-- CreateIndex
CREATE INDEX "idx_rewards_expires" ON "user_rewards"("expires_at") WHERE (status = 'ACTIVE'::reward_status);

-- CreateIndex
CREATE INDEX "idx_rewards_user_status" ON "user_rewards"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_streak_milestones_user" ON "user_streak_milestones"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_streak_milestones_user_id_milestone_id_key" ON "user_streak_milestones"("user_id", "milestone_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_hunter_id_key" ON "users"("hunter_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_hunter_id" ON "users"("hunter_id");

-- CreateIndex
CREATE INDEX "idx_users_location" ON "users"("last_latitude", "last_longitude") WHERE (location_visible = true);

-- CreateIndex
CREATE INDEX "idx_users_referral_code" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "idx_xp_created_at" ON "xp_transactions"("created_at");

-- CreateIndex
CREATE INDEX "idx_xp_user_id" ON "xp_transactions"("user_id");

-- CreateIndex
CREATE INDEX "idx_email_otps_email" ON "email_otps"("email");

-- AddForeignKey
ALTER TABLE "auth_providers" ADD CONSTRAINT "auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_reward_badge_id_fkey" FOREIGN KEY ("reward_badge_id") REFERENCES "badges"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "discovery_matches" ADD CONSTRAINT "discovery_matches_unmatched_by_fkey" FOREIGN KEY ("unmatched_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "discovery_matches" ADD CONSTRAINT "discovery_matches_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "discovery_matches" ADD CONSTRAINT "discovery_matches_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "discovery_swipes" ADD CONSTRAINT "discovery_swipes_swiped_id_fkey" FOREIGN KEY ("swiped_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "discovery_swipes" ADD CONSTRAINT "discovery_swipes_swiper_id_fkey" FOREIGN KEY ("swiper_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "health_metrics" ADD CONSTRAINT "health_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "discovery_matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reward_pool" ADD CONSTRAINT "reward_pool_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "reward_partners"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_schedule" ADD CONSTRAINT "task_schedule_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_discovery_interests" ADD CONSTRAINT "user_discovery_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "discovery_interests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_discovery_interests" ADD CONSTRAINT "user_discovery_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_dragon_evolutions" ADD CONSTRAINT "user_dragon_evolutions_stage_number_fkey" FOREIGN KEY ("stage_number") REFERENCES "dragon_stages"("stage_number") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_dragon_evolutions" ADD CONSTRAINT "user_dragon_evolutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_fcm_tokens" ADD CONSTRAINT "user_fcm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_onboarding_answers" ADD CONSTRAINT "user_onboarding_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_progression" ADD CONSTRAINT "user_progression_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "reward_pool"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_streak_milestones" ADD CONSTRAINT "user_streak_milestones_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "streak_milestones"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_streak_milestones" ADD CONSTRAINT "user_streak_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users_dragon_stage" FOREIGN KEY ("dragon_stage") REFERENCES "dragon_stages"("stage_number") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
