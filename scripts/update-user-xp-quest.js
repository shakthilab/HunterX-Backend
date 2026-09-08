// scripts/update-user-xp-quest.js
import prisma from '../src/config/prisma.js';
import { checkLevelUp } from '../src/services/xpService.js';
import { getCurrentUser } from '../src/services/authService.js';

async function updateQuestXP() {
  const email = 'shakthikumar.dev@gmail.com';
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user) {
    console.error(`User ${email} not found.`);
    process.exit(1);
  }

  const currentProgression = await prisma.user_progression.findUnique({
    where: { user_id: user.id },
  });

  const startingXP = currentProgression?.total_xp ?? 210;
  // +70 for weekly quest, -10 for pending task = net +60 XP
  const netAdjustment = +70 - 10;
  const newTotalXP = startingXP + netAdjustment;

  await prisma.$transaction(async (tx) => {
    // 1. Create XP transaction log for weekly quest (+70)
    await tx.xp_transactions.create({
      data: {
        user_id: user.id,
        amount: 70,
        reason: 'WEEKLY_QUEST: Completed Weekly Quest',
      },
    });

    // 2. Create XP transaction log for pending task penalty (-10)
    await tx.xp_transactions.create({
      data: {
        user_id: user.id,
        amount: -10,
        reason: 'PENDING_TASK_PENALTY: Today pending task deduction',
      },
    });

    // 3. Update total XP on user progression
    await tx.user_progression.update({
      where: { user_id: user.id },
      data: { total_xp: newTotalXP },
    });

    // 4. Recalculate level & check level up
    await checkLevelUp(tx, user.id);
  });

  const fullUser = await getCurrentUser(user.id);
  console.log('Updated User Progression:', JSON.stringify(fullUser.user_progression, null, 2));
}

updateQuestXP()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
