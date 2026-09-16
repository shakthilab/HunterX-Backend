// scripts/assign-todays-tasks-now.js
//
// Backfills task_schedule for TODAY for every active, onboarded user —
// same core loop as src/cron/midnight.js#runNightlyTaskAssignment, but
// callable standalone (importing midnight.js directly would also
// register its node-cron schedule in this process).
//
// Needed whenever a new is_default_daily/WEEKLY/DAILY_ADMIN task is added
// mid-day (e.g. the new "Daily Steps" task): the request-time fallback in
// taskService.js#getTodayTasks only calls assignDailyTasks when a user has
// ZERO task_schedule rows for today, so a user who already opened the app
// today won't pick up the new task on their own until the next midnight
// cron run. This runs it for everyone right now instead. Idempotent and
// safe to re-run any time (assignDailyTasks skips tasks already assigned).
//
// Usage: node scripts/assign-todays-tasks-now.js

import 'dotenv/config'; // standalone script — src/index.js normally does this
import prisma from '../src/config/prisma.js';
import { assignDailyTasks } from '../src/services/taskAssignmentService.js';
import { getISTDateOnly } from '../src/utils/helpers.js';

async function main() {
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
      console.error(`Task assignment failed for user ${user.id}: ${err.message}`);
    }
  }

  console.log(
    `Done — ${users.length} active user(s) checked, ` +
    `${assignedTotal} new task_schedule row(s) created, ${failedCount} failed.`
  );
}

main()
  .catch(err => {
    console.error('assign-todays-tasks-now failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
