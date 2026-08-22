// src/cron/midnight.js — Nightly task-assignment cron, scheduled for
// 00:30 IST (19:00 UTC), ahead of the 7 AM DAILY_MOTIVATION push.
//
// Trigger A of the automatic task-assignment system (see
// src/services/taskAssignmentService.js): for every active user, assigns
// today's routine daily tasks + any weekly task recurring today + any
// admin one-off task scheduled for today. Covers all EXISTING users so
// their tasks are ready before they even open the app.
//
// Safe to re-run / overlap with the request-time fallback (trigger C) —
// assignDailyTasks() is idempotent per user/date.

import cron from 'node-cron';
import prisma from '../config/prisma.js';
import { assignDailyTasks } from '../services/taskAssignmentService.js';
import { getISTDateOnly } from '../utils/helpers.js';
import { info, logError } from '../utils/logger.js';

export async function runNightlyTaskAssignment() {
  const today = getISTDateOnly();

  const users = await prisma.users.findMany({
    where:  { onboarding_done: true, is_banned: false },
    select: { id: true },
  });

  let assignedTotal = 0;
  let failedCount   = 0;

  for (const user of users) {
    try {
      const { assigned } = await assignDailyTasks(user.id, today);
      assignedTotal += assigned;
    } catch (err) {
      failedCount += 1;
      logError(`Nightly task assignment failed for user ${user.id}: ${err.message}`);
    }
  }

  info(
    `Nightly task assignment done — ${users.length} active users, ` +
    `${assignedTotal} task_schedule rows created, ${failedCount} user(s) failed`
  );
}

// Cron schedule: 0 19 * * * corresponding to 00:30 IST (19:00 UTC)
export const midnightJob = cron.schedule('0 19 * * *', () => {
  runNightlyTaskAssignment().catch(err =>
    logError(`Nightly task assignment run crashed: ${err.message}`)
  );
});

export default midnightJob;
