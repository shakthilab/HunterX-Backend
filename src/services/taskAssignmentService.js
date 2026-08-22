// src/services/taskAssignmentService.js — Automatic per-user task assignment
//
// Single source of truth for "what tasks does user X get on date Y". Called
// from all three trigger points:
//   A. the nightly cron (src/cron/midnight.js) — for every active user
//   B. the signup hook (src/services/authService.js#processOnboarding) — for
//      the one user who just finished onboarding
//   C. the request-time fallback (src/services/taskService.js#getTodayTasks)
//      — for whichever user just asked for their task list
//
// Idempotent by design: task_schedule has a UNIQUE(user_id, task_id,
// active_date) constraint, and inserts use skipDuplicates (ON CONFLICT DO
// NOTHING), so re-running this for a user/date that's already populated is
// always a safe no-op. It only ever adds rows — it never deletes or
// modifies a task a user has already been assigned.

import prisma from '../config/prisma.js';

// date is a UTC-midnight Date representing an IST calendar day — same
// convention as getISTDateOnly()/getISTWeekStart() in utils/helpers.js.
// Day-of-week uses Date.getUTCDay() (0=Sun .. 6=Sat) for recurrence_days.
export async function assignDailyTasks(userId, date) {
  const bUserId = typeof userId === 'bigint' ? userId : BigInt(userId);
  const dayOfWeek = date.getUTCDay();

  const [routine, weekly, adminOneOff] = await Promise.all([
    // 1. Routine daily tasks — same 3 tasks, every user, every day, no exceptions.
    prisma.tasks.findMany({
      where: { is_active: true, is_default_daily: true },
      select: { id: true },
    }),
    // 2. Weekly tasks recurring on this specific day of week.
    prisma.tasks.findMany({
      where: {
        is_active:  true,
        task_type:  'WEEKLY',
        recurrence_days: { has: dayOfWeek },
      },
      select: { id: true },
    }),
    // 3. Admin one-off tasks scheduled for this exact date, optionally
    //    targeting only a subset of users (no targets rows = all users).
    prisma.tasks.findMany({
      where: {
        is_active:      true,
        task_type:      'DAILY_ADMIN',
        scheduled_date: date,
      },
      select: {
        id: true,
        task_admin_targets: { select: { user_id: true } },
      },
    }),
  ]);

  const eligibleAdminIds = adminOneOff
    .filter(t => t.task_admin_targets.length === 0 || t.task_admin_targets.some(x => x.user_id === bUserId))
    .map(t => t.id);

  const taskIds = [
    ...routine.map(t => t.id),
    ...weekly.map(t => t.id),
    ...eligibleAdminIds,
  ];

  if (taskIds.length === 0) return { assigned: 0 };

  const result = await prisma.$transaction(tx =>
    tx.task_schedule.createMany({
      data: taskIds.map(task_id => ({
        user_id:     bUserId,
        task_id,
        active_date: date,
      })),
      skipDuplicates: true, // -> ON CONFLICT DO NOTHING on (user_id, task_id, active_date)
    })
  );

  return { assigned: result.count };
}
