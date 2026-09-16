// scripts/reset-user-progress.js
import prisma from '../src/config/prisma.js';
import { getCurrentUser } from '../src/services/authService.js';
import { getWeekStatus } from '../src/services/taskService.js';

async function resetUserProgress() {
  const email = 'shakthikumar.dev@gmail.com';
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user) {
    console.error(`User ${email} not found.`);
    process.exit(1);
  }

  console.log(`Resetting task completions, XP, and streak for user ${user.name} (id=${user.id})...`);

  await prisma.$transaction(async (tx) => {
    // 1. Delete all task completions
    await tx.task_completions.deleteMany({
      where: { user_id: user.id },
    });

    // 2. Delete all XP transactions
    await tx.xp_transactions.deleteMany({
      where: { user_id: user.id },
    });

    // 3. Reset user_progression to fresh baseline
    await tx.user_progression.update({
      where: { user_id: user.id },
      data: {
        total_xp: 0,
        current_level: 1,
        daily_streak: 0,
        weekly_streak: 0,
        consecutive_miss_days: 0,
        last_active_date: null,
        streak_lives: 1,
      },
    });
  });

  const fullUser = await getCurrentUser(user.id);
  const weekStatus = await getWeekStatus(user.id);

  console.log('--- RESET COMPLETE ---');
  console.log('User Progression:', JSON.stringify(fullUser.user_progression, null, 2));
  console.log('Week Status:', JSON.stringify(weekStatus, null, 2));
  console.log('Badges Array (Permanent Record):', JSON.stringify(fullUser.badges, null, 2));
}

resetUserProgress()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
