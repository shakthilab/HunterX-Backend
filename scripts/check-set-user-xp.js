// scripts/check-set-user-xp.js
import prisma from '../src/config/prisma.js';
import { checkLevelUp } from '../src/services/xpService.js';
import { getCurrentUser } from '../src/services/authService.js';

async function updateXP() {
  const email = 'shakthikumar.dev@gmail.com';
  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  // 7 days x 30 XP/day = 210 XP
  const targetXP = 210;

  await prisma.$transaction(async (tx) => {
    await tx.user_progression.update({
      where: { user_id: user.id },
      data: { total_xp: targetXP },
    });
    await checkLevelUp(tx, user.id);
  });

  const fullUser = await getCurrentUser(user.id);
  console.log('Updated Progression:', JSON.stringify(fullUser.user_progression, null, 2));
}

updateXP()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
