// src/services/adminTaskService.js — Admin-authored task creation
//
// Admins create two kinds of tasks here:
//   DAILY_ADMIN — assignable on a date window [start_date, end_date]:
//                 one-time (is_recurring=false) collapses that window to a
//                 single day (end_date = start_date); recurring
//                 (is_recurring=true) spans every day through an
//                 admin-set end_date. Optionally targeted at a subset of
//                 users via task_admin_targets (no targets = everyone).
//   WEEKLY      — a quest that fires on given days of the week
//                 (recurrence_days, 0=Sun..6=Sat) within a date window:
//                 one-time is a single 7-day window (end_date =
//                 start_date + 6); recurring repeats every week through
//                 an admin-set end_date.
// Both windows can start in the future — taskAssignmentService picks a
// task up automatically once `date` (today, or the day the nightly cron
// is running for) falls inside [start_date, end_date].
// DAILY_FIXED is not creatable here — those 3 routine tasks are seed-managed
// (prisma/seed.js) since every user gets exactly those three, every day.

import prisma from '../config/prisma.js';
import { parseDateOnly, getISTDateOnly } from '../utils/helpers.js';

const CREATABLE_TYPES  = ['DAILY_ADMIN', 'WEEKLY'];
const LEVEL_TARGETS     = ['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const MS_PER_DAY        = 24 * 60 * 60 * 1000;
const WEEKLY_WINDOW_DAYS = 6; // a week window is start_date .. start_date+6 (7 days inclusive)

// Design cap from the task XP system (see prisma/seed.js commit notes):
// daily tasks max out at 10 XP, weekly quests at 70 — keeps admin-created
// challenges in line with the fixed routine tasks instead of skewing the
// XP economy.
const XP_CAP = { DAILY_ADMIN: 10, WEEKLY: 70 };

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export async function createTask(adminId, body) {
  const {
    title,
    description,
    tag,
    image_url,
    task_type,
    xp_reward,
    xp_partial,
    allows_partial = false,
    target_value,
    target_unit,
    level_target = 'ALL',
    is_recurring,
    start_date,
    end_date,
    recurrence_days,
    target_user_ids,
  } = body ?? {};

  if (!title?.trim()) throw new Error('TITLE_REQUIRED');
  if (!CREATABLE_TYPES.includes(task_type)) throw new Error('INVALID_TASK_TYPE');
  if (!LEVEL_TARGETS.includes(level_target)) throw new Error('INVALID_LEVEL_TARGET');
  if (typeof is_recurring !== 'boolean') throw new Error('IS_RECURRING_REQUIRED');

  if (
    target_value !== undefined && target_value !== null &&
    (typeof target_value !== 'number' || !Number.isFinite(target_value) || target_value < 0)
  ) throw new Error('INVALID_TARGET_VALUE');

  if (xp_reward !== undefined && (!Number.isInteger(xp_reward) || xp_reward <= 0))
    throw new Error('INVALID_XP_REWARD');
  const resolvedXpReward = xp_reward ?? XP_CAP[task_type];
  if (resolvedXpReward > XP_CAP[task_type]) throw new Error('XP_REWARD_EXCEEDS_CAP');

  if (allows_partial) {
    if (xp_partial === undefined || !Number.isInteger(xp_partial) || xp_partial <= 0)
      throw new Error('INVALID_XP_PARTIAL');
    if (xp_partial >= resolvedXpReward) throw new Error('XP_PARTIAL_MUST_BE_LESS_THAN_REWARD');
  }

  // ── Date window: start_date is required for both types and can be
  // future-dated; end_date is derived for one-time tasks, admin-supplied
  // (and validated) for recurring ones.
  if (!start_date) throw new Error('START_DATE_REQUIRED');
  const parsedStart = parseDateOnly(start_date);
  if (!parsedStart) throw new Error('INVALID_START_DATE');
  if (parsedStart.getTime() < getISTDateOnly().getTime()) throw new Error('START_DATE_IN_PAST');

  let parsedEnd;
  if (is_recurring) {
    if (!end_date) throw new Error('END_DATE_REQUIRED');
    parsedEnd = parseDateOnly(end_date);
    if (!parsedEnd) throw new Error('INVALID_END_DATE');
    if (parsedEnd.getTime() < parsedStart.getTime()) throw new Error('END_DATE_BEFORE_START_DATE');
    if (task_type === 'WEEKLY' && parsedEnd.getTime() < addDays(parsedStart, WEEKLY_WINDOW_DAYS).getTime())
      throw new Error('END_DATE_TOO_SOON'); // must span at least one full 7-day week
  } else {
    // One-time: the window is fixed by task_type, not admin input.
    parsedEnd = task_type === 'WEEKLY' ? addDays(parsedStart, WEEKLY_WINDOW_DAYS) : parsedStart;
  }

  const data = {
    title:          title.trim(),
    description:    description ?? null,
    tag:            tag ?? null,
    image_url:      image_url ?? null,
    task_type,
    xp_reward:      resolvedXpReward,
    xp_partial:     allows_partial ? xp_partial : 0,
    allows_partial,
    target_value:   target_value ?? null,
    target_unit:    target_unit ?? null,
    level_target,
    is_recurring,
    is_default_daily: false,
    start_date:     parsedStart,
    end_date:       parsedEnd,
    recurrence_days: [],
    is_active:      true,
    created_by:     BigInt(adminId),
  };

  if (task_type === 'WEEKLY') {
    if (!Array.isArray(recurrence_days) || recurrence_days.length === 0)
      throw new Error('RECURRENCE_DAYS_REQUIRED');
    if (recurrence_days.some(d => !Number.isInteger(d) || d < 0 || d > 6))
      throw new Error('INVALID_RECURRENCE_DAYS');

    data.recurrence_days = [...new Set(recurrence_days)];
  }

  // Only DAILY_ADMIN supports per-user targeting — the WEEKLY assignment
  // query (taskAssignmentService.js) doesn't consult task_admin_targets.
  let targetUserIds = [];
  if (task_type === 'DAILY_ADMIN' && target_user_ids !== undefined) {
    if (!Array.isArray(target_user_ids)) throw new Error('INVALID_TARGET_USER_IDS');
    try {
      targetUserIds = [...new Set(target_user_ids.map(id => BigInt(id)))];
    } catch {
      throw new Error('INVALID_TARGET_USER_IDS');
    }

    if (targetUserIds.length > 0) {
      const found = await prisma.users.findMany({
        where:  { id: { in: targetUserIds } },
        select: { id: true },
      });
      if (found.length !== targetUserIds.length) throw new Error('TARGET_USER_NOT_FOUND');
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.tasks.create({ data });

    if (targetUserIds.length > 0) {
      await tx.task_admin_targets.createMany({
        data: targetUserIds.map(user_id => ({ task_id: created.id, user_id })),
      });
    }

    return created;
  });

  return {
    ...task,
    target_user_ids: targetUserIds.length > 0 ? targetUserIds : null,
  };
}
