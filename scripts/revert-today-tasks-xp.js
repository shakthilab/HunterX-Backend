// scripts/revert-today-tasks-xp.js
import prisma from '../src/config/prisma.js';
import { getISTDateOnly } from '../src/utils/helpers.js';
import { checkLevelUp } from '../src/services/xpService.js';
import { getCurrentUser } from '../src/services/authService.js';
import { getWeekStatus } from '../src/services/taskService.js';

async function revertToday() {
  const email = 'shakthikumar.dev@gmail.com';
  const user = await prisma.users.findUnique({
    where: { email },
    include: { user_progression: true },
  });

  if (!user) {
    console.error(`User ${email} not found.`);
    process.exit(1);
  }

  const today = getISTDateOnly();
  console.log(`Reverting today's tasks and XP for user ${user.name} (id=${user.id}) on ${today.toISOString().slice(0, 10)}...`);

  // Find all task completions for today
  const todayCompletions = await prisma.task_completions.findMany({
    where: {
      user_id: user.id,
      schedule_date: today,
    },
  });

  const xpToRevert = todayCompletions.reduce((acc, c) => acc + (c.xp_earned || 0), 0);
  console.log(`Found ${todayCompletions.length} completion(s) today totaling ${xpToRevert} XP.`);

  await prisma.$transaction(async (tx) => {
    // Delete today's task completions
    if (todayCompletions.length > 0) {
      await tx.task_completions.deleteMany({
        where: {
          user_id: user.id,
          schedule_date: today,
        },
      });
    }

    // Delete today's XP transactions associated with tasks
    await tx.xp_transactions.deleteMany({
      where: {
        user_id: user.id,
        created_at: { gte: today },
      },
    });

    // Revert XP on progression
    const currentProg = await tx.user_progression.findUnique({ where: { user_id: user.id } });
    const currentXP = currentProg?.total_xp ?? 0;
    const newXP = Math.max(0, currentXP - xpToRevert);

    await tx.user_progression.update({
      where: { user_id: user.id },
      data: {
        total_xp: newXP,
      },
    });

    // Recalculate level
    await checkLevelUp(tx, user.id);
  });

  const fullUser = await getCurrentUser(user.id);
  const weekStatus = await getWeekStatus(user.id);

  console.log('--- REVERT COMPLETE ---');
  console.log('User Progression:', JSON.stringify(fullUser.user_progression, null, 2));
  console.log('Week Status:', JSON.stringify(weekStatus, null, 2));
}

revertToday()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
