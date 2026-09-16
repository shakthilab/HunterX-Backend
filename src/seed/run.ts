// Seeds a Supabase database with the same admin account + demo data used by
// the in-memory driver. Meaningful only when DB_DRIVER=supabase — the memory
// driver seeds itself automatically at process startup.
import { env } from '../config/env';
import { getSupabaseClient } from '../db/supabase/client';
import { hashPassword } from '../utils/password';
import {
  buildSeedUsers,
  buildSeedTasks,
  buildSeedCompletions,
  buildSeedReviews,
  buildSeedTransactions,
  buildSeedReferralActivity,
  buildSeedCouponActivity,
} from '../db/memory/seed';

async function main() {
  if (env.dbDriver !== 'supabase') {
    console.log(
      `[seed] DB_DRIVER is "${env.dbDriver}", not "supabase" — nothing to do. ` +
        `The memory driver seeds itself in-process at startup. Set DB_DRIVER=supabase (and SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) to run this against a real database.`
    );
    return;
  }

  const db = getSupabaseClient();

  console.log('[seed] building seed data...');
  const users = await buildSeedUsers();
  const tasks = buildSeedTasks();
  const completions = buildSeedCompletions(tasks);
  const reviews = buildSeedReviews(tasks);
  const transactions = buildSeedTransactions();
  const referralActivity = buildSeedReferralActivity();
  const couponActivity = buildSeedCouponActivity();

  console.log(`[seed] upserting ${users.length} users...`);
  for (const u of users) {
    const { error } = await db.from('users').upsert({
      id: u.id,
      hunter_id: u.hunterId,
      display_name: u.displayName,
      email: u.email,
      avatar_url: u.avatarUrl,
      level: u.level,
      xp: u.xp,
      rank: u.rank,
      current_streak: u.currentStreak,
      longest_streak: u.longestStreak,
      dragon_stage: u.dragonStage,
      height_cm: u.heightCm,
      weight_kg: u.weightKg,
      bmi: u.bmi,
      status: u.status,
      ban_reason: u.banReason,
      auth_provider: u.authProvider,
      role: u.role,
      password_hash: u.passwordHash,
      created_at: u.createdAt,
    });
    if (error) throw error;

    for (const entry of u.activityLog) {
      await db.from('user_activity_log').upsert({
        id: entry.id,
        user_id: u.id,
        task_title: entry.taskTitle,
        completed_at: entry.completedAt,
        xp_earned: entry.xpEarned,
        verification_status: entry.verificationStatus,
      });
    }
    for (const badge of u.badges) {
      await db.from('user_badges').upsert({ id: badge.id, user_id: u.id, name: badge.name, description: badge.description, earned_at: badge.earnedAt });
    }
    for (const claim of u.rewardClaims) {
      await db.from('user_reward_claims').upsert({ id: claim.id, user_id: u.id, reward_name: claim.rewardName, type: claim.type, claimed_at: claim.claimedAt });
    }
    for (const ticket of u.feedbackTickets) {
      await db.from('user_feedback_tickets').upsert({
        id: ticket.id,
        user_id: u.id,
        subject: ticket.subject,
        message: ticket.message,
        rating: ticket.rating,
        status: ticket.status,
        created_at: ticket.createdAt,
      });
    }
  }

  console.log(`[seed] upserting ${tasks.length} tasks...`);
  for (const t of tasks) {
    const { error } = await db.from('tasks').upsert({
      id: t.id,
      title: t.title,
      description: t.description,
      tag: t.tag,
      image_url: t.imageUrl,
      type: t.type,
      is_default_daily: t.isDefaultDaily,
      recurrence_days: t.recurrenceDays,
      start_date: t.startDate,
      end_date: t.endDate,
      level_target: t.levelTarget,
      target_value: t.targetValue,
      target_unit: t.targetUnit,
      allows_partial: t.allowsPartial,
      xp_partial: t.xpPartial,
      xp_reward: t.xpReward,
      verification_method: t.verificationMethod,
      verification_config: t.verificationConfig,
      reward_eligibility: t.rewardEligibility,
      status: t.status,
      created_at: t.createdAt,
    });
    if (error) throw error;
  }

  console.log(`[seed] upserting ${completions.length} task completions...`);
  for (const c of completions) {
    await db.from('task_completions').upsert({
      id: c.id,
      task_id: c.taskId,
      user_id: c.userId,
      user_name: c.userName,
      date: c.date,
      value_achieved: c.valueAchieved,
      verification_status: c.verificationStatus,
    });
  }

  console.log(`[seed] upserting ${reviews.length} pending reviews...`);
  for (const r of reviews) {
    await db.from('pending_reviews').upsert({
      id: r.id,
      task_id: r.taskId,
      task_title: r.taskTitle,
      user_id: r.userId,
      user_name: r.userName,
      submitted_value: r.submittedValue,
      submitted_unit: r.submittedUnit,
      submitted_at: r.submittedAt,
      verification_method: r.verificationMethod,
      gps_session_summary: r.gpsSessionSummary,
      photo_url: r.photoUrl,
      flag_reason: r.flagReason,
      status: r.status,
    });
  }

  console.log(`[seed] upserting ${transactions.length} transactions...`);
  for (const tx of transactions) {
    await db.from('transactions').upsert({ id: tx.id, user_name: tx.userName, plan: tx.plan, amount: tx.amount, status: tx.status, date: tx.date, method: tx.method });
  }

  console.log(`[seed] upserting ${referralActivity.length} referral activity rows...`);
  for (const [i, r] of referralActivity.entries()) {
    await db.from('referral_activity').upsert({
      id: r.id,
      referrer_id: null,
      referrer_name: r.referrerName,
      referee_name: r.refereeName,
      status: r.status,
      date: r.date,
    });
  }

  console.log(`[seed] upserting ${couponActivity.length} coupon activity rows...`);
  for (const c of couponActivity) {
    await db.from('coupon_activity').upsert({ id: c.id, code: c.code, partner: c.partner, user_name: c.userName, action: c.action, date: c.date });
  }

  console.log('[seed] done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
