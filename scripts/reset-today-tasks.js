// scripts/reset-today-tasks.js
import prisma from '../src/config/prisma.js';
import { getISTDateOnly } from '../src/utils/helpers.js';
import { getWeekStatus } from '../src/services/taskService.js';

async function resetTodayTasks() {
  const email = 'shakthikumar.dev@gmail.com';
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user) {
    console.error(`User ${email} not found.`);
    process.exit(1);
  }

  const today = getISTDateOnly();
  console.log(`Deleting today's task completions (${today.toISOString().slice(0, 10)}) for user ${user.name} (id=${user.id})...`);

  const deleted = await prisma.task_completions.deleteMany({
    where: {
      user_id: user.id,
      schedule_date: today,
    },
  });

  console.log(`Deleted ${deleted.count} completion row(s) for today.`);

  const weekStatus = await getWeekStatus(user.id);
  console.log('Week Status:', JSON.stringify(weekStatus, null, 2));
}

resetTodayTasks()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
