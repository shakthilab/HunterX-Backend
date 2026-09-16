// scripts/complete-all-week-tasks.js
import prisma from '../src/config/prisma.js';
import { getWeekStatus } from '../src/services/taskService.js';

async function updateWeekStatus() {
  const email = 'shakthikumar.dev@gmail.com';
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user) {
    console.error(`User ${email} not found.`);
    process.exit(1);
  }

  // Find a daily task
  const task = await prisma.tasks.findFirst({
    where: { task_type: 'DAILY_FIXED' },
  });

  if (!task) {
    console.error('No DAILY_FIXED task found.');
    process.exit(1);
  }

  console.log(`Using task "${task.title}" (id=${task.id}) for user id=${user.id}`);

  // Week dates: 2026-08-31 to 2026-09-06
  const dates = [
    '2026-08-31',
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-06',
  ];

  for (const dateStr of dates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const scheduleDate = new Date(Date.UTC(y, m - 1, d));

    await prisma.task_completions.upsert({
      where: {
        user_id_task_id_schedule_date: {
          user_id: user.id,
          task_id: task.id,
          schedule_date: scheduleDate,
        },
      },
      create: {
        user_id: user.id,
        task_id: task.id,
        schedule_date: scheduleDate,
        status: 'COMPLETED',
        xp_earned: task.xp_reward,
        completed_at: scheduleDate,
      },
      update: {
        status: 'COMPLETED',
        xp_earned: task.xp_reward,
        completed_at: scheduleDate,
      },
    });

    console.log(`Upserted completion for ${dateStr}`);
  }

  const newWeekStatus = await getWeekStatus(user.id);
  console.log('New Week Status:', JSON.stringify(newWeekStatus, null, 2));
}

updateWeekStatus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
