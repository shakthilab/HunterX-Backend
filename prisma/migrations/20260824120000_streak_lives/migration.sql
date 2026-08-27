-- Streak lives ("streak freeze" system)
--
-- Every user gets 1 life at signup (existing DEFAULT 1 covers new rows;
-- user_progression is created with just user_id at signup — see
-- authService.js#createBaseUser — so every field default applies).
-- Earned +1 per 7-day daily_streak reached (see streakService.js), spent
-- 1-for-1 to cover missed days when the user opts in via
-- POST /api/tasks/streak/resolve. Capped at 2.
--
-- Supersedes the existing users.streak_freeze_available /
-- streak_freeze_used_this_month boolean columns for this purpose — those
-- are left in place (unused single-flag design doesn't fit a 0-2 counter)
-- rather than dropped, matching how tasks.scheduled_date was left in
-- place when start_date/end_date superseded it.

ALTER TABLE "user_progression"
  ADD COLUMN "streak_lives" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "user_progression_streak_lives_range" CHECK ("streak_lives" BETWEEN 0 AND 2);
