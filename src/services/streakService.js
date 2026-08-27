// src/services/streakService.js — Daily streak tracking + streak lives
//
// ── The streak itself ───────────────────────────────────────────
// bumpDailyStreak(tx, userId) runs live, inside the same transaction as
// a task completion (see taskService.js#setTaskCompletion) — only for
// DAILY_FIXED/DAILY_ADMIN tasks with status COMPLETED or PARTIAL; WEEKLY
// tasks and SKIPPED never feed it. Completing/partially-completing at
// least ONE daily task on a given IST calendar day maintains that day; a
// day only ever counts once, gated by user_progression.last_active_date.
//
// ── Streak lives ────────────────────────────────────────────────
// Every user starts with 1 life (user_progression.streak_lives, DEFAULT
// 1 — the row is created at signup with just user_id, so this applies to
// every new account automatically). +1 life is earned every time
// daily_streak reaches a multiple of 7, capped at 2. A life absorbs one
// missed day each.
//
// Two ways a gap gets covered:
//   1. Automatic/silent (bumpDailyStreak): if the user just goes ahead
//      and completes a task after a gap, and enough lives are banked to
//      cover the whole gap (missed_days <= streak_lives), the gap is
//      covered transparently and the streak keeps counting — no
//      confirmation needed.
//   2. Interactive (getStreakRiskStatus / resolveStreakRisk): called
//      from GET /api/tasks/today and POST /api/tasks/streak/resolve, so
//      the app can show the user a "your streak is at risk — use a life
//      or let it drop?" prompt BEFORE they've done anything that day.
//      Choosing USE_LIVES pre-emptively covers the same gap (same
//      effect as path 1, just proactive); choosing DROP breaks the
//      streak to 0 immediately instead of waiting for it to lazily
//      reset to 1 on next completion.
// A gap wider than the banked lives can cover is never "at risk" (there's
// no decision to make) — it just breaks on next completion, same as
// before streak lives existed.
//
// XP is never touched by any of this, in either direction — streak
// state and XP are fully independent ledgers.

import prisma from '../config/prisma.js';
import { getISTDateOnly } from '../utils/helpers.js';

const MS_PER_DAY   = 24 * 60 * 60 * 1000;
const MAX_LIVES     = 2;
const LIFE_EVERY_N_DAYS = 7;

function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// missed_days > 0 means at least one full day passed with no activity;
// covered means enough lives are banked to erase the whole gap.
function computeGap(progression, today) {
  const lastActive = progression?.last_active_date ?? null;
  const daysSince   = lastActive ? daysBetween(lastActive, today) : null;
  const missedDays  = daysSince !== null && daysSince > 1 ? daysSince - 1 : 0;
  const lives       = progression?.streak_lives ?? 1;
  return {
    daysSince,
    missedDays,
    lives,
    coveredByLives: missedDays > 0 && missedDays <= lives,
  };
}

// Must run inside the caller's transaction so a rollback can't leave XP
// recorded without the streak (or vice versa). `tx` is a Prisma
// transaction client; `userId` is already a BigInt.
export async function bumpDailyStreak(tx, userId) {
  const today = getISTDateOnly();

  const progression = await tx.user_progression.findUnique({ where: { user_id: userId } });
  const { daysSince, missedDays, lives, coveredByLives } = computeGap(progression, today);

  if (daysSince === 0) return; // already counted today — no-op

  const continuing    = daysSince === 1 || coveredByLives;
  const currentStreak = progression?.daily_streak ?? 0;
  const newStreak      = continuing ? currentStreak + 1 : 1;
  const livesSpent      = coveredByLives ? missedDays : 0;
  const livesAfterSpend = lives - livesSpent;
  const earnedLife       = newStreak > 0 && newStreak % LIFE_EVERY_N_DAYS === 0 && livesAfterSpend < MAX_LIVES;
  const newLives          = earnedLife ? livesAfterSpend + 1 : livesAfterSpend;

  await tx.user_progression.upsert({
    where: { user_id: userId },
    create: {
      user_id:               userId,
      daily_streak:          1,
      longest_streak:        1,
      consecutive_miss_days: 0,
      last_active_date:      today,
      streak_lives:          newLives,
    },
    update: {
      daily_streak:          newStreak,
      longest_streak:        Math.max(progression?.longest_streak ?? 0, newStreak),
      consecutive_miss_days: continuing ? 0 : missedDays,
      last_active_date:      today,
      streak_lives:          newLives,
    },
  });
}

// Read-only — surfaced in GET /api/tasks/today so the client can decide
// whether to show the "use a life or let it drop?" prompt before the
// user has done anything today.
export async function getStreakRiskStatus(userId) {
  const today       = getISTDateOnly();
  const progression = await prisma.user_progression.findUnique({ where: { user_id: userId } });
  const { missedDays, lives, coveredByLives } = computeGap(progression, today);

  return {
    daily_streak:   progression?.daily_streak ?? 0,
    longest_streak: progression?.longest_streak ?? 0,
    streak_lives:   lives,
    at_risk:        coveredByLives,       // true only when there's an actual decision to make
    missed_days:    coveredByLives ? missedDays : 0,
  };
}

// The user's explicit choice from the "streak at risk" prompt.
// action: 'USE_LIVES' spends missed_days lives and forgives the gap
//         without touching daily_streak itself — the streak resumes
//         counting normally the next time the user actually completes a
//         daily task (bumpDailyStreak sees a clean 1-day gap then).
// action: 'DROP' breaks the streak to 0 immediately instead of waiting
//         for the lazy reset-to-1 a plain missed gap would otherwise get
//         on next completion.
export async function resolveStreakRisk(userId, action) {
  if (!['USE_LIVES', 'DROP'].includes(action)) throw new Error('INVALID_ACTION');

  const today       = getISTDateOnly();
  const progression = await prisma.user_progression.findUnique({ where: { user_id: userId } });
  const { missedDays, coveredByLives } = computeGap(progression, today);

  if (!coveredByLives) throw new Error('NOTHING_TO_RESOLVE');

  const yesterday = new Date(today.getTime() - MS_PER_DAY);

  const updated = action === 'USE_LIVES'
    ? await prisma.user_progression.update({
        where: { user_id: userId },
        data: {
          streak_lives:     { decrement: missedDays },
          last_active_date: yesterday, // erases the gap; next completion continues normally
        },
      })
    : await prisma.user_progression.update({
        where: { user_id: userId },
        data: {
          daily_streak:          0,
          consecutive_miss_days: 0,
          last_active_date:      null,
        },
      });

  return {
    daily_streak:   updated.daily_streak,
    longest_streak: updated.longest_streak,
    streak_lives:   updated.streak_lives,
  };
}
