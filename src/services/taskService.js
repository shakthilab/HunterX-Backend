// src/services/taskService.js — Daily & weekly task fetching + completion logic

import prisma from '../config/prisma.js';
import { getISTDateOnly, getISTWeekStart } from '../utils/helpers.js';
import { assignDailyTasks } from './taskAssignmentService.js';
import { bumpDailyStreak, getStreakRiskStatus } from './streakService.js';

const DAILY_TYPES     = ['DAILY_FIXED', 'DAILY_ADMIN'];
const VALID_STATUSES  = ['COMPLETED', 'PARTIAL', 'SKIPPED'];

// The "period key" a task's completion is tracked against —
// one row per day for daily tasks, one row per week for weekly quests.
function periodDateFor(taskType) {
  return taskType === 'WEEKLY' ? getISTWeekStart() : getISTDateOnly();
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

// Convention: a task with target_value = null and tag = 'NUTRITION' pulls
// its target from the user's own calculated daily_protein_goal instead of
// a fixed value on the task row (see prisma/seed.js).
function resolveTarget(task, user) {
  if (task.target_value === null && task.tag === 'NUTRITION') {
    return user.daily_protein_goal ?? null;
  }
  return task.target_value;
}

// ─────────────────────────────────────────────────────────────
// GET — today's daily tasks + this week's weekly quests, each
// with the user's completion status/XP for the current period
// ─────────────────────────────────────────────────────────────

export async function getTodayTasks(userId) {
  const bUserId = BigInt(userId);

  const user = await prisma.users.findUnique({
    where:  { id: bUserId },
    select: { daily_protein_goal: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  const todayDate     = getISTDateOnly();
  const weekStartDate = getISTWeekStart();
  const weekEndDate   = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6); // Sunday of the current ISO week

  // Trigger C — request-time fallback. If this user has no task_schedule
  // rows for today yet (cron didn't run, server was down, timezone edge
  // case, brand-new user whose signup hook failed, etc.), assign them now
  // so they're never shown an empty list. Idempotent — safe even if the
  // nightly cron already ran for this user today.
  const alreadyAssigned = await prisma.task_schedule.count({
    where: { user_id: bUserId, active_date: todayDate },
  });
  if (alreadyAssigned === 0) {
    await assignDailyTasks(bUserId, todayDate);
  }

  // Daily: whatever was assigned to this user for today.
  const dailySchedule = await prisma.task_schedule.findMany({
    where: {
      user_id:     bUserId,
      active_date: todayDate,
      tasks:       { is_active: true, task_type: { in: DAILY_TYPES } },
    },
    include: { tasks: true },
  });

  // Weekly: assigned any day this ISO week (Mon–Sun) — once a weekly
  // task is assigned on its recurrence day it stays visible/completable
  // for the rest of the week, matching the week-keyed completion
  // tracking below. `distinct` guards against a task recurring on more
  // than one day this week producing duplicate rows.
  const weeklySchedule = await prisma.task_schedule.findMany({
    where: {
      user_id:     bUserId,
      active_date: { gte: weekStartDate, lte: weekEndDate },
      tasks:       { is_active: true, task_type: 'WEEKLY' },
    },
    include:  { tasks: true },
    distinct: ['task_id'],
  });

  const eligible = [...dailySchedule, ...weeklySchedule].map(s => s.tasks);

  const completions = await prisma.task_completions.findMany({
    where: {
      user_id:       bUserId,
      task_id:       { in: eligible.map(t => t.id) },
      schedule_date: { in: [todayDate, weekStartDate] },
    },
  });
  const completionMap = new Map(
    completions.map(c => [`${c.task_id}_${dateKey(c.schedule_date)}`, c])
  );

  function serialize(task) {
    const periodDate = periodDateFor(task.task_type);
    const completion = completionMap.get(`${task.id}_${dateKey(periodDate)}`) || null;

    return {
      id:             task.id,
      title:          task.title,
      description:    task.description,
      tag:            task.tag,
      image_url:      task.image_url,
      task_type:      task.task_type,
      xp_reward:      task.xp_reward,
      xp_partial:     task.xp_partial,
      allows_partial: task.allows_partial,
      target_value:   resolveTarget(task, user),
      target_unit:    task.target_unit,
      is_recurring:   task.is_recurring,
      // null for DAILY_FIXED (no admin-set window); for DAILY_ADMIN/WEEKLY
      // this is the task's validity window — see adminTaskService.js
      start_date:     task.start_date ? dateKey(task.start_date) : null,
      end_date:       task.end_date ? dateKey(task.end_date) : null,
      // Not a DB value — PENDING just means "no completion row yet"
      status:         completion?.status ?? 'PENDING',
      progress_value: completion?.progress_value ?? null,
      xp_earned:      completion?.xp_earned ?? 0,
      completed_at:   completion?.completed_at ?? null,
    };
  }

  const daily  = eligible.filter(t => DAILY_TYPES.includes(t.task_type)).map(serialize);
  const weekly = eligible.filter(t => t.task_type === 'WEEKLY').map(serialize);

  const streak = await getStreakRiskStatus(bUserId);

  return {
    date:               dateKey(todayDate),
    week_start:         dateKey(weekStartDate),
    daily,
    weekly,
    daily_xp_earned:    daily.reduce((s, t) => s + t.xp_earned, 0),
    daily_xp_possible:  daily.reduce((s, t) => s + t.xp_reward, 0),
    weekly_xp_earned:   weekly.reduce((s, t) => s + t.xp_earned, 0),
    weekly_xp_possible: weekly.reduce((s, t) => s + t.xp_reward, 0),
    // streak.at_risk true = show the "use a life or let it drop?" prompt;
    // see POST /api/tasks/streak/resolve
    streak,
  };
}

// ─────────────────────────────────────────────────────────────
// PUT — set this task's completion status for the current period
// Idempotent: same (status, progress_value) always ends in the
// same state; XP is adjusted by the delta from whatever the row
// previously held (so flipping COMPLETED -> PARTIAL -> SKIPPED
// -> COMPLETED never double-counts or under-counts XP).
// ─────────────────────────────────────────────────────────────

// Authorization gate: a task only being active isn't enough — the caller
// must actually have it on their list for the current period, i.e. a
// task_schedule row exists for them (same source of truth GET /today
// reads from). Without this, any logged-in user could mark XP-earning
// completions on a task never assigned to them — another user's targeted
// DAILY_ADMIN task, or one whose date window hasn't opened/has already
// closed.
async function assertAssignedToUser(bUserId, task) {
  if (task.task_type === 'WEEKLY') {
    const weekStart = getISTWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    const row = await prisma.task_schedule.findFirst({
      where: {
        user_id:     bUserId,
        task_id:     task.id,
        active_date: { gte: weekStart, lte: weekEnd },
      },
      select: { id: true },
    });
    if (!row) throw new Error('TASK_NOT_ASSIGNED');
  } else {
    const row = await prisma.task_schedule.findUnique({
      where: {
        user_id_task_id_active_date: {
          user_id:     bUserId,
          task_id:     task.id,
          active_date: getISTDateOnly(),
        },
      },
      select: { id: true },
    });
    if (!row) throw new Error('TASK_NOT_ASSIGNED');
  }
}

export async function setTaskCompletion(userId, taskId, { status, progressValue }) {
  if (!VALID_STATUSES.includes(status)) throw new Error('INVALID_STATUS');

  if (
    progressValue !== undefined && progressValue !== null &&
    (typeof progressValue !== 'number' || !Number.isFinite(progressValue) || progressValue < 0)
  ) {
    throw new Error('INVALID_PROGRESS_VALUE');
  }

  const bUserId = BigInt(userId);
  const bTaskId = BigInt(taskId);

  const task = await prisma.tasks.findUnique({ where: { id: bTaskId } });
  if (!task || !task.is_active) throw new Error('TASK_NOT_FOUND');

  if (status === 'PARTIAL' && !task.allows_partial) throw new Error('PARTIAL_NOT_ALLOWED');

  await assertAssignedToUser(bUserId, task);

  const periodDate = periodDateFor(task.task_type);

  // Flat XP per status — the schema tracks one xp_partial amount per task,
  // not a sliding scale off progress_value.
  const xpEarned = status === 'COMPLETED' ? task.xp_reward
                  : status === 'PARTIAL'  ? task.xp_partial
                  : /* SKIPPED */           0;

  const completion = await prisma.$transaction(async (tx) => {
    const existing = await tx.task_completions.findUnique({
      where: {
        user_id_task_id_schedule_date: {
          user_id:       bUserId,
          task_id:       bTaskId,
          schedule_date: periodDate,
        },
      },
    });

    // Once COMPLETED, a task is locked — no more status changes for this
    // period. Resending COMPLETED again is still a no-op success (same
    // idempotent rule as always); only switching AWAY from it is blocked.
    if (existing?.status === 'COMPLETED' && status !== 'COMPLETED') {
      throw new Error('TASK_ALREADY_COMPLETED');
    }

    const upserted = await tx.task_completions.upsert({
      where: {
        user_id_task_id_schedule_date: {
          user_id:       bUserId,
          task_id:       bTaskId,
          schedule_date: periodDate,
        },
      },
      create: {
        user_id:        bUserId,
        task_id:        bTaskId,
        schedule_date:  periodDate,
        status,
        progress_value: progressValue ?? null, // not sent by the client yet — stored if it ever is
        xp_earned:      xpEarned,
        completed_at:   status === 'SKIPPED' ? null : new Date(),
      },
      update: {
        status,
        progress_value: progressValue ?? null,
        xp_earned:      xpEarned,
        completed_at:   status === 'SKIPPED' ? null : new Date(),
      },
    });

    const delta = xpEarned - (existing?.xp_earned ?? 0);

    if (delta !== 0) {
      await tx.xp_transactions.create({
        data: {
          user_id: bUserId,
          task_id: bTaskId,
          amount:  delta,
          reason:  `TASK_${status}: ${task.title}`,
        },
      });

      await tx.user_progression.upsert({
        where:  { user_id: bUserId },
        create: { user_id: bUserId, total_xp: Math.max(delta, 0) },
        update: { total_xp: { increment: delta } },
      });
    }

    // Streak is a daily-tasks concept only, and only COMPLETED/PARTIAL
    // count as "active today" — marking a task SKIPPED must not extend
    // the streak. (If a task is flipped from COMPLETED to SKIPPED later
    // the same day, the streak already bumped for that day stays bumped —
    // the user genuinely was active that day, this just isn't the call
    // that should be granting it.)
    if (DAILY_TYPES.includes(task.task_type) && status !== 'SKIPPED') {
      await bumpDailyStreak(tx, bUserId);
    }

    return upserted;
  });

  const progression = await prisma.user_progression.findUnique({ where: { user_id: bUserId } });

  return {
    task_id:        task.id,
    title:          task.title,
    task_type:      task.task_type,
    status:         completion.status,
    progress_value: completion.progress_value,
    target_value:   task.target_value,
    target_unit:    task.target_unit,
    xp_reward:      task.xp_reward,
    xp_partial:     task.xp_partial,
    xp_earned:      completion.xp_earned,
    completed_at:   completion.completed_at,
    total_xp:       progression?.total_xp ?? 0,
    daily_streak:   progression?.daily_streak ?? 0,
    longest_streak: progression?.longest_streak ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// PUT — reopen a task: SKIPPED -> PENDING, the only direction this
// goes. There's no "PENDING" completion_status to set (PENDING is just
// the absence of a task_completions row), so reopening deletes the row.
// COMPLETED is locked (setTaskCompletion already rejects switching away
// from it), and PARTIAL isn't reopenable through this endpoint either —
// only a SKIPPED row can be undone. No XP or streak side effects: a
// SKIPPED row always held xp_earned=0 and never bumped the streak, so
// there's nothing to reverse.
// ─────────────────────────────────────────────────────────────

export async function reopenTask(userId, taskId) {
  const bUserId = BigInt(userId);
  const bTaskId = BigInt(taskId);

  const task = await prisma.tasks.findUnique({ where: { id: bTaskId } });
  if (!task || !task.is_active) throw new Error('TASK_NOT_FOUND');

  await assertAssignedToUser(bUserId, task);

  const periodDate = periodDateFor(task.task_type);
  const where = {
    user_id_task_id_schedule_date: {
      user_id:       bUserId,
      task_id:       bTaskId,
      schedule_date: periodDate,
    },
  };

  const existing = await prisma.task_completions.findUnique({ where });
  if (!existing) throw new Error('TASK_ALREADY_PENDING'); // nothing to undo
  if (existing.status !== 'SKIPPED') throw new Error('TASK_NOT_SKIPPED');

  await prisma.task_completions.delete({ where });

  return {
    task_id:   task.id,
    title:     task.title,
    task_type: task.task_type,
    status:    'PENDING',
  };
}
