// src/services/rewardService.js — Streak-milestone reward granting
//
// Grants the physical/cosmetic reward tied to a streak_milestones row
// once a streak hits that day count. Called only from
// streakService.js#bumpDailyStreak, inside its transaction. No XP is
// ever paid here — streak_milestones.xp_bonus is seeded 0 for every row
// and deliberately unread by this file; XP only ever comes from
// taskService.js/xpService.js on task completion. Idempotent per
// (user, milestone) via user_streak_milestones' unique constraint.

import { createNotification } from './notificationService.js';

export async function grantStreakMilestoneReward(tx, userId, milestone) {
  const alreadyAwarded = await tx.user_streak_milestones.findUnique({
    where: { user_id_milestone_id: { user_id: userId, milestone_id: milestone.id } },
  });
  if (alreadyAwarded) return { granted: false };

  await tx.user_streak_milestones.create({
    data: {
      user_id:      userId,
      milestone_id: milestone.id,
      streak_days:  milestone.streak_days,
    },
  });

  if (milestone.reward_type === 'COUPON') {
    await grantCoupon(tx, userId, milestone);
  } else if (milestone.reward_type === 'BADGE') {
    await grantBadge(tx, userId, milestone);
  }
  // XP_BONUS is intentionally not handled — streak milestones no longer
  // pay XP (see prisma/seed.js STREAK_MILESTONES).

  await createNotification(
    tx, userId, 'STREAK_MILESTONE',
    `${milestone.streak_days}-day streak!`,
    milestone.description || `You've hit a ${milestone.streak_days}-day streak.`,
    { event: 'STREAK_MILESTONE', streak_days: milestone.streak_days, reward_type: milestone.reward_type }
  );

  return { granted: true };
}

const TRIGGER_BY_STREAK_DAYS = {
  7: 'STREAK_7', 14: 'STREAK_14', 21: 'STREAK_21',
  30: 'STREAK_30', 60: 'STREAK_60', 90: 'STREAK_90',
};

// Claims one unassigned reward_pool code for this user. A no-op (besides
// the milestone record + notification already written above) when the
// pool is empty for this trigger — inventory is an ops/seeding concern,
// not something a streak completion should ever fail on.
async function grantCoupon(tx, userId, milestone) {
  const trigger = TRIGGER_BY_STREAK_DAYS[milestone.streak_days];
  if (!trigger) return;

  const code = await tx.reward_pool.findFirst({ where: { is_assigned: false } });
  if (!code) return;

  await tx.reward_pool.update({ where: { id: code.id }, data: { is_assigned: true } });
  await tx.user_rewards.create({
    data: { user_id: userId, pool_id: code.id, trigger_type: trigger, status: 'ACTIVE' },
  });
}

// Awards the badge whose name matches this milestone's description, if
// one has been seeded under that name (see BADGES in prisma/seed.js) —
// same "content not seeded is a no-op, not an error" stance as
// grantCoupon.
async function grantBadge(tx, userId, milestone) {
  const badge = await tx.badges.findFirst({ where: { name: milestone.description } });
  if (!badge) return;

  await tx.user_badges.upsert({
    where:  { user_id_badge_id: { user_id: userId, badge_id: badge.id } },
    create: { user_id: userId, badge_id: badge.id },
    update: {},
  });
}
