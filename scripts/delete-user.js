// scripts/delete-user.js
// Script to safely and completely delete a user and all related records by email.

import 'dotenv/config';
import prisma from '../src/config/prisma.js';

const email = process.argv[2] || 'athreya2420@gmail.com';

async function main() {
  console.log(`Looking up user with email: ${email}...`);
  const user = await prisma.users.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    console.log(`No user found with email "${email}". Checking email_otps...`);
    const otps = await prisma.email_otps.findMany({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });
    if (otps.length > 0) {
      console.log(`Found ${otps.length} OTP record(s). Deleting OTPs...`);
      const deletedOtps = await prisma.email_otps.deleteMany({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
      });
      console.log(`Deleted ${deletedOtps.count} OTP record(s).`);
    } else {
      console.log('No OTP records found either.');
    }
    return;
  }

  const userId = user.id;
  console.log(`Found user: ID=${userId.toString()}, HunterID=${user.hunter_id}, Name=${user.name}, Email=${user.email}`);

  // Inspect related records
  const counts = {
    auth_providers: await prisma.auth_providers.count({ where: { user_id: userId } }),
    discovery_matches_a: await prisma.discovery_matches.count({ where: { user_a_id: userId } }),
    discovery_matches_b: await prisma.discovery_matches.count({ where: { user_b_id: userId } }),
    discovery_matches_unmatched_by: await prisma.discovery_matches.count({ where: { unmatched_by: userId } }),
    discovery_swipes_swiper: await prisma.discovery_swipes.count({ where: { swiper_id: userId } }),
    discovery_swipes_swiped: await prisma.discovery_swipes.count({ where: { swiped_id: userId } }),
    health_metrics: await prisma.health_metrics.count({ where: { user_id: userId } }),
    leaderboard: await prisma.leaderboard.count({ where: { user_id: userId } }),
    messages_sent: await prisma.messages.count({ where: { sender_id: userId } }),
    notifications: await prisma.notifications.count({ where: { user_id: userId } }),
    referrals_as_referrer: await prisma.referrals.count({ where: { referrer_id: userId } }),
    referrals_as_referred: await prisma.referrals.count({ where: { referred_id: userId } }),
    referred_users: await prisma.users.count({ where: { referred_by: userId } }),
    subscriptions: await prisma.subscriptions.count({ where: { user_id: userId } }),
    task_admin_targets: await prisma.task_admin_targets.count({ where: { user_id: userId } }),
    task_completions: await prisma.task_completions.count({ where: { user_id: userId } }),
    task_schedule: await prisma.task_schedule.count({ where: { user_id: userId } }),
    tasks_created: await prisma.tasks.count({ where: { created_by: userId } }),
    user_badges: await prisma.user_badges.count({ where: { user_id: userId } }),
    user_discovery_interests: await prisma.user_discovery_interests.count({ where: { user_id: userId } }),
    user_dragon_evolutions: await prisma.user_dragon_evolutions.count({ where: { user_id: userId } }),
    user_fcm_tokens: await prisma.user_fcm_tokens.count({ where: { user_id: userId } }),
    user_onboarding_answers: await prisma.user_onboarding_answers.count({ where: { user_id: userId } }),
    user_progression: await prisma.user_progression.count({ where: { user_id: userId } }),
    user_rewards: await prisma.user_rewards.count({ where: { user_id: userId } }),
    user_streak_milestones: await prisma.user_streak_milestones.count({ where: { user_id: userId } }),
    xp_transactions: await prisma.xp_transactions.count({ where: { user_id: userId } }),
    email_otps: await prisma.email_otps.count({ where: { email: { equals: user.email, mode: 'insensitive' } } }),
  };

  console.log('Related records summary:', counts);

  console.log('Beginning deletion in transaction...');

  await prisma.$transaction(async (tx) => {
    // 1. Unlink other users referred by this user
    await tx.users.updateMany({
      where: { referred_by: userId },
      data: { referred_by: null },
    });

    // 2. Unlink/clean tasks created by this user
    await tx.tasks.updateMany({
      where: { created_by: userId },
      data: { created_by: null },
    });

    // 3. Clear unmatched_by on discovery_matches
    await tx.discovery_matches.updateMany({
      where: { unmatched_by: userId },
      data: { unmatched_by: null },
    });

    // 4. Delete sent messages before match/user deletion
    await tx.messages.deleteMany({
      where: { sender_id: userId },
    });

    // 5. Delete discovery matches involving this user
    await tx.discovery_matches.deleteMany({
      where: {
        OR: [
          { user_a_id: userId },
          { user_b_id: userId },
        ],
      },
    });

    // 6. Delete discovery swipes involving this user
    await tx.discovery_swipes.deleteMany({
      where: {
        OR: [
          { swiper_id: userId },
          { swiped_id: userId },
        ],
      },
    });

    // 7. Delete referrals involving this user
    await tx.referrals.deleteMany({
      where: {
        OR: [
          { referrer_id: userId },
          { referred_id: userId },
        ],
      },
    });

    // 8. Delete OTP records for this email
    if (user.email) {
      await tx.email_otps.deleteMany({
        where: {
          email: {
            equals: user.email,
            mode: 'insensitive',
          },
        },
      });
    }

    // 9. Delete explicit cascade/child tables (even though Prisma/DB schema has onDelete: Cascade, doing it explicitly guarantees clean deletion across any DB constraint configs)
    await tx.auth_providers.deleteMany({ where: { user_id: userId } });
    await tx.health_metrics.deleteMany({ where: { user_id: userId } });
    await tx.leaderboard.deleteMany({ where: { user_id: userId } });
    await tx.notifications.deleteMany({ where: { user_id: userId } });
    await tx.subscriptions.deleteMany({ where: { user_id: userId } });
    await tx.task_admin_targets.deleteMany({ where: { user_id: userId } });
    await tx.task_completions.deleteMany({ where: { user_id: userId } });
    await tx.task_schedule.deleteMany({ where: { user_id: userId } });
    await tx.user_badges.deleteMany({ where: { user_id: userId } });
    await tx.user_discovery_interests.deleteMany({ where: { user_id: userId } });
    await tx.user_dragon_evolutions.deleteMany({ where: { user_id: userId } });
    await tx.user_fcm_tokens.deleteMany({ where: { user_id: userId } });
    await tx.user_onboarding_answers.deleteMany({ where: { user_id: userId } });
    await tx.user_progression.deleteMany({ where: { user_id: userId } });
    await tx.user_rewards.deleteMany({ where: { user_id: userId } });
    await tx.user_streak_milestones.deleteMany({ where: { user_id: userId } });
    await tx.xp_transactions.deleteMany({ where: { user_id: userId } });

    // 10. Delete the user
    await tx.users.delete({
      where: { id: userId },
    });
  });

  console.log(`Successfully deleted user ${email} (ID: ${userId}) and all associated records.`);
}

main()
  .catch((err) => {
    console.error('Failed to delete user:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
