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

export async function syncUserAgesForBirthdays(today) {
  const usersWithDob = await prisma.users.findMany({
    where: {
      date_of_birth: { not: null },
    },
    select: {
      id: true,
      date_of_birth: true,
      age: true,
    },
  });

  let updatedCount = 0;

  for (const user of usersWithDob) {
    try {
      const dob = user.date_of_birth;
      let calculatedAge = today.getUTCFullYear() - dob.getUTCFullYear();
      const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
      const dayDiff = today.getUTCDate() - dob.getUTCDate();
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        calculatedAge--;
      }

      if (user.age !== calculatedAge) {
        await prisma.users.update({
          where: { id: user.id },
          data: { age: calculatedAge },
        });
        updatedCount++;
      }
    } catch (err) {
      logError(`Failed to update age for user ${user.id}: ${err.message}`);
    }
  }

  if (updatedCount > 0) {
    info(`Daily birthday age sync completed: updated ${updatedCount} user(s)`);
  }
}

export async function runNightlyTaskAssignment() {
  const today = getISTDateOnly();

  // Run daily birthday sync first
  await syncUserAgesForBirthdays(today);

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
