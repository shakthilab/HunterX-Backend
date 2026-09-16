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

export const STREAK_MILESTONE_BADGES = {
  7:   { name: 'Ember Vow',          description: 'Reached a 7-day daily streak' },
  14:  { name: 'Iron Resolve',       description: 'Reached a 14-day daily streak' },
  30:  { name: 'Shadow Oath',        description: 'Reached a 30-day daily streak' },
  60:  { name: 'Phantom Discipline', description: 'Reached a 60-day daily streak' },
  90:  { name: 'Sovereign Will',     description: 'Reached a 90-day daily streak' },
  200: { name: 'Void Ascendant',     description: 'Reached a 200-day daily streak' },
  365: { name: 'Eternal Hunter',     description: 'Reached a 365-day daily streak' },
};

export async function checkAndAwardStreakMilestoneBadge(tx, userId, streakDays) {
  const badgeInfo = STREAK_MILESTONE_BADGES[streakDays];
  if (!badgeInfo) return { granted: false };

  // Find or create the badge row in badges table if missing
  let badge = await tx.badges.findUnique({
    where: { name: badgeInfo.name },
  });

  if (!badge) {
    badge = await tx.badges.create({
      data: {
        name:        badgeInfo.name,
        description: badgeInfo.description,
        badge_type:  'STREAK',
      },
    });
  }

  // Idempotency check — check if badge already earned in user_badges
  const existingUserBadge = await tx.user_badges.findUnique({
    where: {
      user_id_badge_id: {
        user_id:  userId,
        badge_id: badge.id,
      },
    },
  });

  if (existingUserBadge) {
    return { granted: false, badge };
  }

  // Insert permanent record in user_badges
  await tx.user_badges.create({
    data: {
      user_id:  userId,
      badge_id: badge.id,
      earned_at: new Date(),
    },
  });

  // Also record in user_streak_milestones if milestone exists
  const milestone = await tx.streak_milestones.findUnique({ where: { streak_days: streakDays } });
  if (milestone) {
    const alreadyInUserMilestones = await tx.user_streak_milestones.findUnique({
      where: { user_id_milestone_id: { user_id: userId, milestone_id: milestone.id } },
    });
    if (!alreadyInUserMilestones) {
      await tx.user_streak_milestones.create({
        data: {
          user_id:      userId,
          milestone_id: milestone.id,
          streak_days:  streakDays,
        },
      });
      if (milestone.reward_type === 'COUPON') {
        await grantCoupon(tx, userId, milestone);
      }
    }
  }

  // Fire STREAK_MILESTONE notification
  await createNotification(
    tx, userId, 'STREAK_MILESTONE',
    `${streakDays}-day streak!`,
    badgeInfo.description || `You've hit a ${streakDays}-day streak.`,
    { event: 'STREAK_MILESTONE', streak_days: streakDays, badge_id: badge.id, badge_name: badge.name }
  );

  return { granted: true, badge };
}

export async function grantStreakMilestoneReward(tx, userId, milestone) {
  return await checkAndAwardStreakMilestoneBadge(tx, userId, milestone.streak_days);
}

const TRIGGER_BY_STREAK_DAYS = {
  7: 'STREAK_7', 14: 'STREAK_14', 21: 'STREAK_21',
  30: 'STREAK_30', 60: 'STREAK_60', 90: 'STREAK_90',
};

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

async function grantBadge(tx, userId, milestone) {
  const badge = await tx.badges.findFirst({ where: { name: milestone.description } });
  if (!badge) return;

  await tx.user_badges.upsert({
    where:  { user_id_badge_id: { user_id: userId, badge_id: badge.id } },
    create: { user_id: userId, badge_id: badge.id },
    update: {},
  });
}

