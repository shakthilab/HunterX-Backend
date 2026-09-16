// scripts/test-permanent-streak-badges.js
import prisma from '../src/config/prisma.js';
import { checkAndAwardStreakMilestoneBadge } from '../src/services/rewardService.js';
import { getCurrentUser } from '../src/services/authService.js';

async function runTest() {
  console.log('--- STARTING PERMANENT STREAK BADGE VERIFICATION TEST ---');

  // 1. Create a test user
  const timestamp = Date.now();
  const testEmail = `test_badge_${timestamp}@example.com`;
  const hunterId = `TST${String(timestamp).slice(-5)}`;

  const user = await prisma.users.create({
    data: {
      hunter_id: hunterId,
      name: 'Badge Test Hunter',
      email: testEmail,
      referral_code: `REF${String(timestamp).slice(-5)}`,
    },
  });

  const userId = user.id;

  await prisma.user_progression.create({
    data: {
      user_id: userId,
      daily_streak: 0,
      longest_streak: 0,
      streak_lives: 0,
    },
  });

  console.log(`Created test user with id=${userId}`);

  try {
    // 2. Simulate user reaching daily_streak = 7 -> Ember Vow badge
    console.log('Simulating daily_streak reaching 7...');
    await prisma.$transaction(async (tx) => {
      await tx.user_progression.update({
        where: { user_id: userId },
        data: { daily_streak: 7 },
      });
      await checkAndAwardStreakMilestoneBadge(tx, userId, 7);
    });

    const badgesAfter7 = await prisma.user_badges.findMany({
      where: { user_id: userId },
      include: { badges: true },
    });
    console.log(`Badges after streak=7 (${badgesAfter7.length} badges):`, badgesAfter7.map(b => b.badges.name));

    if (!badgesAfter7.some(b => b.badges.name === 'Ember Vow')) {
      throw new Error('FAILED: Ember Vow badge not found after streak=7');
    }

    // 3. Continue to daily_streak = 14 -> Iron Resolve badge
    console.log('Simulating daily_streak reaching 14...');
    await prisma.$transaction(async (tx) => {
      await tx.user_progression.update({
        where: { user_id: userId },
        data: { daily_streak: 14 },
      });
      await checkAndAwardStreakMilestoneBadge(tx, userId, 14);
    });

    const badgesAfter14 = await prisma.user_badges.findMany({
      where: { user_id: userId },
      include: { badges: true },
    });
    console.log(`Badges after streak=14 (${badgesAfter14.length} badges):`, badgesAfter14.map(b => b.badges.name));

    if (!badgesAfter14.some(b => b.badges.name === 'Iron Resolve')) {
      throw new Error('FAILED: Iron Resolve badge not found after streak=14');
    }

    // 4. Simulate missing enough consecutive days (with streak_lives exhausted) to force daily_streak back to 0
    console.log('Simulating streak drop to 0...');
    await prisma.user_progression.update({
      where: { user_id: userId },
      data: {
        daily_streak: 0,
        consecutive_miss_days: 3,
        last_active_date: null,
      },
    });

    // Query user_badges for this user afterward
    const badgesAfterReset = await prisma.user_badges.findMany({
      where: { user_id: userId },
      include: { badges: true },
    });
    console.log(`Badges in DB after streak reset to 0 (${badgesAfterReset.length} badges):`, badgesAfterReset.map(b => b.badges.name));

    if (badgesAfterReset.length !== 2 ||
        !badgesAfterReset.some(b => b.badges.name === 'Ember Vow') ||
        !badgesAfterReset.some(b => b.badges.name === 'Iron Resolve')) {
      throw new Error('FAILED: Badges did not survive streak reset');
    }

    // 5. Query getCurrentUser (GET /api/auth/me)
    console.log('Querying getCurrentUser (GET /api/auth/me)...');
    const meUser = await getCurrentUser(userId);

    console.log('User progression daily_streak:', meUser.user_progression.daily_streak);
    console.log('User badges array in /me response:', JSON.stringify(meUser.badges, null, 2));

    if (meUser.user_progression.daily_streak !== 0) {
      throw new Error(`Expected daily_streak 0, got ${meUser.user_progression.daily_streak}`);
    }

    if (!Array.isArray(meUser.badges) || meUser.badges.length !== 2) {
      throw new Error(`Expected meUser.badges to contain 2 badges, got ${meUser.badges?.length}`);
    }

    const badgeNames = meUser.badges.map(b => b.name);
    if (!badgeNames.includes('Ember Vow') || !badgeNames.includes('Iron Resolve')) {
      throw new Error(`Expected Ember Vow & Iron Resolve in /me response, got ${badgeNames.join(', ')}`);
    }

    const emberBadge = meUser.badges.find(b => b.name === 'Ember Vow');
    if (emberBadge.badge_type !== 'STREAK_MILESTONE' || emberBadge.milestone_days !== 7) {
      throw new Error(`Invalid badge metadata for Ember Vow: ${JSON.stringify(emberBadge)}`);
    }

    const ironBadge = meUser.badges.find(b => b.name === 'Iron Resolve');
    if (ironBadge.badge_type !== 'STREAK_MILESTONE' || ironBadge.milestone_days !== 14) {
      throw new Error(`Invalid badge metadata for Iron Resolve: ${JSON.stringify(ironBadge)}`);
    }

    // 6. Test Idempotency: re-reach streak 7 in a future cycle
    console.log('Testing idempotency: re-reaching streak = 7...');
    await prisma.$transaction(async (tx) => {
      await tx.user_progression.update({
        where: { user_id: userId },
        data: { daily_streak: 7 },
      });
      const result = await checkAndAwardStreakMilestoneBadge(tx, userId, 7);
      if (result.granted) {
        throw new Error('FAILED: Badge was granted second time for same milestone!');
      }
    });

    const badgesAfterReReach = await prisma.user_badges.findMany({
      where: { user_id: userId },
    });
    if (badgesAfterReReach.length !== 2) {
      throw new Error(`Idempotency check failed: expected 2 user_badges, found ${badgesAfterReReach.length}`);
    }

    console.log('SUCCESS: All verification checks passed clean!');
  } finally {
    // Clean up test user
    console.log('Cleaning up test user...');
    await prisma.user_badges.deleteMany({ where: { user_id: userId } });
    await prisma.user_streak_milestones.deleteMany({ where: { user_id: userId } });
    await prisma.notifications.deleteMany({ where: { user_id: userId } });
    await prisma.user_progression.deleteMany({ where: { user_id: userId } });
    await prisma.users.delete({ where: { id: userId } });
    console.log('Cleanup finished.');
  }
}

runTest()
  .then(() => {
    console.log('--- VERIFICATION SUCCEEDED ---');
    process.exit(0);
  })
  .catch((err) => {
    console.error('--- VERIFICATION FAILED ---', err);
    process.exit(1);
  });
