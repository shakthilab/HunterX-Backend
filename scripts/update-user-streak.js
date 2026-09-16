// scripts/update-user-streak.js
import prisma from '../src/config/prisma.js';
import { checkAndAwardStreakMilestoneBadge } from '../src/services/rewardService.js';
import { getCurrentUser } from '../src/services/authService.js';

async function updateAccount() {
  const email = 'shakthikumar.dev@gmail.com';
  const user = await prisma.users.findUnique({
    where: { email },
    include: { user_progression: true },
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (id=${user.id})`);

  const currentLongest = user.user_progression?.longest_streak ?? 0;
  const newLongest = Math.max(7, currentLongest);

  // Update user progression to 7-day streak
  const updatedProgression = await prisma.user_progression.upsert({
    where: { user_id: user.id },
    create: {
      user_id: user.id,
      daily_streak: 7,
      longest_streak: 7,
      streak_lives: 2,
      last_active_date: new Date(),
    },
    update: {
      daily_streak: 7,
      longest_streak: newLongest,
      streak_lives: 2,
      last_active_date: new Date(),
    },
  });

  console.log('Updated user_progression:', updatedProgression);

  // Award the 7-day streak badge ("Ember Vow")
  await prisma.$transaction(async (tx) => {
    const result = await checkAndAwardStreakMilestoneBadge(tx, user.id, 7);
    console.log('Badge award result:', result);
  });

  // Fetch updated user profile as returned by GET /api/auth/me
  const fullUser = await getCurrentUser(user.id);
  console.log('Updated User Badges:', fullUser.badges);
}

updateAccount()
  .then(() => {
    console.log('Successfully updated user account!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error updating user account:', err);
    process.exit(1);
  });
