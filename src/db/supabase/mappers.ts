// Row <-> domain-type mappers for the Supabase driver. Kept in one place so
// the column-naming convention (snake_case in Postgres, camelCase in TS) is
// consistent and easy to audit against supabase/migrations/0001_init.sql.
import type { User, UserActivityLogEntry, UserBadge, UserRewardClaim, UserFeedbackTicket, UserWithPasswordHash } from '../../types/user';
import type { Task, TaskInput, TaskCompletionLogEntry, PendingReviewItem } from '../../types/task';
import type { Transaction, ReferralActivity, CouponActivityEntry } from '../../types/dashboard';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function rowToUser(row: Row, related: {
  activityLog: UserActivityLogEntry[];
  badges: UserBadge[];
  rewardClaims: UserRewardClaim[];
  feedbackTickets: UserFeedbackTicket[];
}): User {
  return {
    id: row.id,
    hunterId: row.hunter_id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    level: row.level,
    xp: row.xp,
    rank: row.rank,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    dragonStage: row.dragon_stage,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    bmi: row.bmi,
    status: row.status,
    banReason: row.ban_reason,
    authProvider: row.auth_provider,
    role: row.role,
    createdAt: row.created_at,
    activityLog: related.activityLog,
    badges: related.badges,
    rewardClaims: related.rewardClaims,
    feedbackTickets: related.feedbackTickets,
  };
}

export function rowToUserWithPassword(row: Row, related: Parameters<typeof rowToUser>[1]): UserWithPasswordHash {
  return { ...rowToUser(row, related), passwordHash: row.password_hash };
}

export function userPatchToRow(patch: Partial<User>): Row {
  const row: Row = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (patch.level !== undefined) row.level = patch.level;
  if (patch.xp !== undefined) row.xp = patch.xp;
  if (patch.rank !== undefined) row.rank = patch.rank;
  if (patch.currentStreak !== undefined) row.current_streak = patch.currentStreak;
  if (patch.longestStreak !== undefined) row.longest_streak = patch.longestStreak;
  if (patch.dragonStage !== undefined) row.dragon_stage = patch.dragonStage;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.banReason !== undefined) row.ban_reason = patch.banReason;
  return row;
}

export function rowToActivityLogEntry(row: Row): UserActivityLogEntry {
  return { id: row.id, taskTitle: row.task_title, completedAt: row.completed_at, xpEarned: row.xp_earned, verificationStatus: row.verification_status };
}

export function rowToBadge(row: Row): UserBadge {
  return { id: row.id, name: row.name, description: row.description, earnedAt: row.earned_at };
}

export function rowToRewardClaim(row: Row): UserRewardClaim {
  return { id: row.id, rewardName: row.reward_name, type: row.type, claimedAt: row.claimed_at };
}

export function rowToFeedbackTicket(row: Row): UserFeedbackTicket {
  return { id: row.id, subject: row.subject, message: row.message, rating: row.rating, status: row.status, createdAt: row.created_at };
}

export function rowToTask(row: Row): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tag: row.tag,
    imageUrl: row.image_url,
    type: row.type,
    isDefaultDaily: row.is_default_daily,
    recurrenceDays: row.recurrence_days,
    startDate: row.start_date,
    endDate: row.end_date,
    levelTarget: row.level_target,
    targetValue: Number(row.target_value),
    targetUnit: row.target_unit,
    allowsPartial: row.allows_partial,
    xpPartial: row.xp_partial,
    xpReward: row.xp_reward,
    verificationMethod: row.verification_method,
    verificationConfig: row.verification_config ?? {},
    rewardEligibility: row.reward_eligibility,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function taskInputToRow(input: TaskInput): Row {
  return {
    title: input.title,
    description: input.description,
    tag: input.tag,
    image_url: input.imageUrl,
    type: input.type,
    is_default_daily: input.isDefaultDaily,
    recurrence_days: input.recurrenceDays,
    start_date: input.startDate,
    end_date: input.endDate,
    level_target: input.levelTarget,
    target_value: input.targetValue,
    target_unit: input.targetUnit,
    allows_partial: input.allowsPartial,
    xp_partial: input.xpPartial,
    xp_reward: input.xpReward,
    verification_method: input.verificationMethod,
    verification_config: input.verificationConfig,
    status: input.status,
  };
}

export function rowToCompletion(row: Row): TaskCompletionLogEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    userName: row.user_name,
    date: row.date,
    valueAchieved: Number(row.value_achieved),
    verificationStatus: row.verification_status,
  };
}

export function rowToPendingReview(row: Row): PendingReviewItem {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    userId: row.user_id,
    userName: row.user_name,
    submittedValue: Number(row.submitted_value),
    submittedUnit: row.submitted_unit,
    submittedAt: row.submitted_at,
    verificationMethod: row.verification_method,
    gpsSessionSummary: row.gps_session_summary,
    photoUrl: row.photo_url,
    flagReason: row.flag_reason,
    status: row.status,
  };
}

export function rowToTransaction(row: Row): Transaction {
  return {
    id: row.id,
    userName: row.user_name,
    plan: row.plan,
    amount: Number(row.amount),
    status: row.status,
    date: row.date,
    method: row.method,
  };
}

export function rowToReferralActivity(row: Row): ReferralActivity {
  return { id: row.id, referrerName: row.referrer_name, refereeName: row.referee_name, status: row.status, date: row.date };
}

export function rowToCouponActivity(row: Row): CouponActivityEntry {
  return { id: row.id, code: row.code, partner: row.partner, userName: row.user_name, action: row.action, date: row.date };
}
