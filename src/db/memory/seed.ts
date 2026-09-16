// In-memory seed data generator. Ports the exact mock-data generation
// approach used in the Arise-Admin frontend (lib/api/users.ts, tasks.ts,
// dashboard.ts) so the shape and "feel" of the data matches what the admin
// UI already renders against its mocks.
import { hashPassword } from '../../utils/password';
import type {
  User,
  UserRank,
  AuthProvider,
  UserActivityLogEntry,
  UserBadge,
  UserRewardClaim,
  UserFeedbackTicket,
} from '../../types/user';
import type {
  Task,
  TaskType,
  VerificationMethod,
  TaskCompletionLogEntry,
  PendingReviewItem,
  RewardEligibility,
} from '../../types/task';
import type {
  Transaction,
  ReferralActivity,
  CouponActivityEntry,
  TopReferrer,
} from '../../types/dashboard';

export function deriveRewardEligibility(xpReward: number, method: VerificationMethod): RewardEligibility {
  if (method === 'gps_tracked' || method === 'health_sync') return xpReward >= 200 ? 'premium' : 'bonus';
  if (xpReward >= 150) return 'bonus';
  return 'standard';
}

function daysAgoIso(days: number, hour = 9): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateLabel(daysBack: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function seeded(index: number, mod: number, offset = 0): number {
  return Math.floor(Math.abs(Math.sin(index * 12.9898 + offset) * 43758.5453)) % mod;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Ava', 'Marcus', 'Priya', 'Diego', 'Grace', 'Noah', 'Liam', 'Sofia', 'Kenji', 'Amara',
  'Elena', 'Tariq', 'Maya', 'Oscar', 'Zoe', 'Hassan', 'Ingrid', 'Leo', 'Nadia', 'Felix',
  'Ruby', 'Mateo', 'Anya', 'Caleb', 'Freya',
];
const LAST_NAMES = [
  'Thompson', 'Lee', 'Sharma', 'Fernandez', 'Kim', 'Williams', 'Carter', 'Rossi', 'Sato', 'Okafor',
  'Petrova', 'Malik', 'Singh', 'Novak', 'Ahmadi', 'Yusuf', 'Larsen', 'Tanaka', 'Haddad', 'Brandt',
  'Alvarez', 'Costa', 'Ivanov', 'Nakamura', 'Bergström',
];
const RANK_ORDER: UserRank[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic'];
const AUTH_PROVIDERS: AuthProvider[] = ['email', 'google', 'apple'];
const BAN_REASONS = ['GPS spoofing detected', 'Abusive chat messages', 'Fraudulent referral activity'];
const BADGE_LIBRARY = [
  { name: 'First Steps', description: 'Completed your first task.' },
  { name: 'Streak Keeper', description: 'Maintained a 7-day streak.' },
  { name: 'Iron Will', description: 'Maintained a 30-day streak.' },
  { name: 'Dragon Rising', description: 'Reached Dragon Stage 3.' },
  { name: 'Community Pillar', description: 'Referred 5 active hunters.' },
  { name: 'Perfect Week', description: 'Completed every daily task for a week.' },
];
const FEEDBACK_SUBJECTS = [
  'GPS tracking loses signal indoors',
  'Love the new dragon cosmetics!',
  'XP not credited after workout',
  'Streak reset without warning',
  'Referral coupon never arrived',
];

function buildActivityLog(index: number): UserActivityLogEntry[] {
  const count = seeded(index, 5, 1) + 1;
  const titles = ['Morning Run', '10-Minute Meditation', 'Deep Work Block', 'Read 20 Pages', 'Hydration Check'];
  return Array.from({ length: count }, (_, i) => ({
    id: `act_${index}_${i}`,
    taskTitle: titles[(index + i) % titles.length],
    completedAt: daysAgoIso(i * 2 + 1, 7 + i),
    xpEarned: 50 + seeded(index, 200, i),
    verificationStatus: (['approved', 'approved', 'pending', 'rejected'] as const)[seeded(index, 4, i + 2)],
  }));
}

function buildBadges(index: number, level: number): UserBadge[] {
  const count = Math.min(BADGE_LIBRARY.length, Math.max(0, Math.floor(level / 4)));
  return BADGE_LIBRARY.slice(0, count).map((badge, i) => ({
    id: `badge_${index}_${i}`,
    name: badge.name,
    description: badge.description,
    earnedAt: daysAgoIso(30 * (i + 1)),
  }));
}

function buildRewardClaims(index: number): UserRewardClaim[] {
  const count = seeded(index, 3, 3);
  const rewardNames = ['XP Booster Pack', "Hunter's Cloak Skin", 'Streak Freeze Token', 'Gold Dragon Emblem'];
  const types: UserRewardClaim['type'][] = ['coupon', 'cosmetic', 'xp_boost'];
  return Array.from({ length: count }, (_, i) => ({
    id: `rwd_${index}_${i}`,
    rewardName: rewardNames[(index + i) % rewardNames.length],
    type: types[(index + i) % types.length],
    claimedAt: daysAgoIso(10 * (i + 1)),
  }));
}

function buildFeedbackTickets(index: number): UserFeedbackTicket[] {
  const count = seeded(index, 2, 4);
  return Array.from({ length: count }, (_, i) => ({
    id: `fbk_${index}_${i}`,
    subject: FEEDBACK_SUBJECTS[(index + i) % FEEDBACK_SUBJECTS.length],
    message: 'Reported from in-app feedback form.',
    rating: seeded(index, 5, i + 5) + 1,
    status: (seeded(index, 2, i + 6) === 0 ? 'open' : 'resolved') as 'open' | 'resolved',
    createdAt: daysAgoIso(5 * (i + 1)),
  }));
}

export type SeededUser = User & { passwordHash: string };

/**
 * Builds the seeded admin account. Credentials/stat values mirror the
 * frontend's dev-only mock-login fallback (lib/auth/actions.ts) exactly, so
 * a real backend login and the frontend's offline dev fallback present the
 * same admin identity.
 */
async function buildAdminUser(): Promise<SeededUser> {
  return {
    id: 'usr_1000',
    hunterId: 'HTR-00001',
    displayName: 'Dev Admin',
    email: 'admin@arise.com',
    avatarUrl: null,
    level: 99,
    xp: 999999,
    rank: 'mythic',
    currentStreak: 30,
    longestStreak: 60,
    dragonStage: 5,
    heightCm: 178,
    weightKg: 74,
    bmi: 23.4,
    status: 'active',
    banReason: null,
    authProvider: 'email',
    role: 'admin',
    createdAt: daysAgoIso(365, 8),
    activityLog: [],
    badges: [],
    rewardClaims: [],
    feedbackTickets: [],
    passwordHash: await hashPassword('admin123'),
  };
}

async function buildRegularUsers(): Promise<SeededUser[]> {
  const placeholderHash = await hashPassword('not-a-real-login');
  return Promise.all(
    Array.from({ length: 25 }, async (_, i) => {
      const firstName = FIRST_NAMES[i];
      const lastName = LAST_NAMES[i];
      const level = 1 + seeded(i, 40, 10);
      const xp = level * (300 + seeded(i, 250, 11));
      const rank = RANK_ORDER[Math.min(RANK_ORDER.length - 1, Math.floor(level / 8))];
      const currentStreak = seeded(i, 46, 12);
      const longestStreak = currentStreak + seeded(i, 20, 13);
      const isBanned = i % 9 === 8;
      const heightCm = 155 + seeded(i, 45, 14);
      const weightKg = 50 + seeded(i, 45, 15);

      const user: SeededUser = {
        id: `usr_${1001 + i}`,
        hunterId: `HTR-${(1001 + i).toString().padStart(5, '0')}`,
        displayName: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        avatarUrl: null,
        level,
        xp,
        rank,
        currentStreak: isBanned ? 0 : currentStreak,
        longestStreak,
        dragonStage: Math.min(5, Math.floor(level / 7)),
        heightCm,
        weightKg,
        bmi: Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10,
        status: isBanned ? 'banned' : 'active',
        banReason: isBanned ? BAN_REASONS[i % BAN_REASONS.length] : null,
        authProvider: AUTH_PROVIDERS[i % AUTH_PROVIDERS.length],
        role: 'user',
        createdAt: daysAgoIso(30 + seeded(i, 500, 16), 8),
        activityLog: buildActivityLog(i),
        badges: buildBadges(i, level),
        rewardClaims: buildRewardClaims(i),
        feedbackTickets: buildFeedbackTickets(i),
        passwordHash: placeholderHash,
      };
      return user;
    })
  );
}

export async function buildSeedUsers(): Promise<SeededUser[]> {
  const [admin, regular] = await Promise.all([buildAdminUser(), buildRegularUsers()]);
  return [admin, ...regular];
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

type TaskSeed = {
  title: string;
  description: string;
  tag: string;
  type: TaskType;
  targetValue: number;
  targetUnit: string;
  xpReward: number;
  verificationMethod: VerificationMethod;
  status: Task['status'];
  isDefaultDaily?: boolean;
  levelTarget?: number | null;
};

const TASK_SEEDS: TaskSeed[] = [
  { title: 'Morning 5K Run', description: 'Complete a 5km run before 9am, tracked live via GPS.', tag: 'Fitness', type: 'daily', targetValue: 5, targetUnit: 'km', xpReward: 220, verificationMethod: 'gps_tracked', status: 'active', isDefaultDaily: true },
  { title: '10-Minute Meditation', description: 'Practice mindful breathing for 10 minutes.', tag: 'Mindfulness', type: 'daily', targetValue: 10, targetUnit: 'minutes', xpReward: 60, verificationMethod: 'manual', status: 'active', isDefaultDaily: true },
  { title: 'Deep Work Block', description: 'Focus on a single task for 90 minutes, distraction-free.', tag: 'Productivity', type: 'daily', targetValue: 90, targetUnit: 'minutes', xpReward: 250, verificationMethod: 'manual', status: 'active' },
  { title: 'Read 20 Pages', description: 'Read at least 20 pages of any book.', tag: 'Learning', type: 'daily', targetValue: 20, targetUnit: 'pages', xpReward: 80, verificationMethod: 'manual', status: 'active' },
  { title: 'Cold Shower Challenge', description: 'Take a 3-minute cold shower.', tag: 'Fitness', type: 'daily', targetValue: 3, targetUnit: 'minutes', xpReward: 200, verificationMethod: 'photo_review', status: 'inactive' },
  { title: 'Weekly Journal Entry', description: 'Write a reflection on the past week.', tag: 'Mindfulness', type: 'weekly', targetValue: 1, targetUnit: 'entry', xpReward: 120, verificationMethod: 'manual', status: 'inactive' },
  { title: '10,000 Steps', description: 'Hit 10,000 steps, synced automatically from your health app.', tag: 'Fitness', type: 'daily', targetValue: 10000, targetUnit: 'steps', xpReward: 150, verificationMethod: 'health_sync', status: 'active', isDefaultDaily: true },
  { title: 'Sleep 7+ Hours', description: 'Log 7 or more hours of sleep, synced from your health app.', tag: 'Wellness', type: 'daily', targetValue: 7, targetUnit: 'hours', xpReward: 100, verificationMethod: 'health_sync', status: 'active' },
  { title: 'Trail Hike Challenge', description: 'Complete a 10km trail hike, tracked via GPS.', tag: 'Fitness', type: 'weekly', targetValue: 10, targetUnit: 'km', xpReward: 300, verificationMethod: 'gps_tracked', status: 'active', levelTarget: 5 },
  { title: 'Meal Prep Photo', description: 'Submit a photo of a healthy home-cooked meal.', tag: 'Nutrition', type: 'daily', targetValue: 1, targetUnit: 'meal', xpReward: 90, verificationMethod: 'photo_review', status: 'active' },
  { title: 'No Sugar Day', description: 'Log a full day without added sugar.', tag: 'Nutrition', type: 'daily', targetValue: 1, targetUnit: 'day', xpReward: 110, verificationMethod: 'manual', status: 'active' },
  { title: 'Monthly Distance Goal', description: 'Accumulate 100km of tracked movement this month.', tag: 'Fitness', type: 'monthly', targetValue: 100, targetUnit: 'km', xpReward: 500, verificationMethod: 'gps_tracked', status: 'active', levelTarget: 10 },
  { title: 'Gratitude List', description: 'Write down three things you are grateful for.', tag: 'Mindfulness', type: 'daily', targetValue: 3, targetUnit: 'items', xpReward: 50, verificationMethod: 'manual', status: 'active' },
  { title: 'Progress Photo Check-in', description: 'Submit a physique progress photo for review.', tag: 'Fitness', type: 'weekly', targetValue: 1, targetUnit: 'photo', xpReward: 140, verificationMethod: 'photo_review', status: 'active' },
  { title: 'Founders Launch Challenge', description: 'One-time challenge for early hunters — complete any 5 tasks.', tag: 'Community', type: 'one_time', targetValue: 5, targetUnit: 'tasks', xpReward: 400, verificationMethod: 'manual', status: 'inactive' },
];

export function buildSeedTasks(): Task[] {
  return TASK_SEEDS.map((seed, i) => ({
    id: `tsk_${2001 + i}`,
    title: seed.title,
    description: seed.description,
    tag: seed.tag,
    imageUrl: null,
    type: seed.type,
    isDefaultDaily: seed.isDefaultDaily ?? false,
    recurrenceDays: seed.type === 'weekly' ? ['mon', 'wed', 'fri'] : null,
    startDate: daysAgoIso(180 - i * 5, 0),
    endDate: null,
    levelTarget: seed.levelTarget ?? null,
    targetValue: seed.targetValue,
    targetUnit: seed.targetUnit,
    allowsPartial: seed.verificationMethod !== 'photo_review',
    xpPartial: seed.verificationMethod !== 'photo_review' ? Math.round(seed.xpReward * 0.4) : null,
    xpReward: seed.xpReward,
    verificationMethod: seed.verificationMethod,
    verificationConfig:
      seed.verificationMethod === 'gps_tracked'
        ? { gpsMinDistanceKm: seed.targetValue, gpsMaxDurationMin: 180 }
        : seed.verificationMethod === 'health_sync'
          ? { healthMetric: (seed.targetUnit === 'steps' ? 'steps' : 'sleep_hours') as 'steps' | 'sleep_hours', healthSyncProvider: 'apple_health' as const }
          : seed.verificationMethod === 'photo_review'
            ? { photoRequiresTimestamp: true, photoInstructions: 'Ensure good lighting and full framing.' }
            : { requiresNote: false },
    rewardEligibility: deriveRewardEligibility(seed.xpReward, seed.verificationMethod),
    status: seed.status,
    createdAt: daysAgoIso(200 - i * 5, 7),
  }));
}

const USER_NAMES = ['Ava Thompson', 'Marcus Lee', 'Priya Sharma', 'Diego Fernandez', 'Grace Kim', 'Noah Williams', 'Liam Carter', 'Sofia Rossi'];

export function buildSeedCompletions(tasks: Task[]): TaskCompletionLogEntry[] {
  return tasks.flatMap((task, ti) =>
    Array.from({ length: 4 }, (_, i) => ({
      id: `cmp_${task.id}_${i}`,
      taskId: task.id,
      userId: `usr_${1001 + ((ti + i) % 8)}`,
      userName: USER_NAMES[(ti + i) % USER_NAMES.length],
      date: daysAgoIso(i + 1, 8 + i),
      valueAchieved: task.targetValue - (i % 2 === 0 ? 0 : Math.round(task.targetValue * 0.2)),
      verificationStatus: (['approved', 'approved', 'pending', 'rejected'] as const)[(ti + i) % 4],
    }))
  );
}

export function buildSeedReviews(tasks: Task[]): PendingReviewItem[] {
  const reviewTasks = tasks.filter((t) => t.verificationMethod === 'gps_tracked' || t.verificationMethod === 'photo_review');
  return reviewTasks.flatMap((task, i) => [
    {
      id: `rev_${task.id}_a`,
      taskId: task.id,
      taskTitle: task.title,
      userId: `usr_${1001 + i}`,
      userName: USER_NAMES[i % USER_NAMES.length],
      submittedValue: task.targetValue * 1.1,
      submittedUnit: task.targetUnit,
      submittedAt: daysAgoIso(i, 10),
      verificationMethod: task.verificationMethod,
      gpsSessionSummary: task.verificationMethod === 'gps_tracked' ? `Route logged ${(task.targetValue * 1.1).toFixed(1)} ${task.targetUnit} over 38 min, avg pace steady.` : null,
      photoUrl: task.verificationMethod === 'photo_review' ? '/mock/review-photo-placeholder.jpg' : null,
      flagReason: task.verificationMethod === 'gps_tracked' ? 'GPS speed spike detected — possible vehicle assist.' : 'Photo metadata timestamp mismatch.',
      status: 'pending' as const,
    },
    {
      id: `rev_${task.id}_b`,
      taskId: task.id,
      taskTitle: task.title,
      userId: `usr_${1005 + i}`,
      userName: USER_NAMES[(i + 3) % USER_NAMES.length],
      submittedValue: task.targetValue * 0.8,
      submittedUnit: task.targetUnit,
      submittedAt: daysAgoIso(i + 1, 15),
      verificationMethod: task.verificationMethod,
      gpsSessionSummary: task.verificationMethod === 'gps_tracked' ? `Route logged ${(task.targetValue * 0.8).toFixed(1)} ${task.targetUnit}, GPS signal dropped twice.` : null,
      photoUrl: task.verificationMethod === 'photo_review' ? '/mock/review-photo-placeholder.jpg' : null,
      flagReason: task.verificationMethod === 'gps_tracked' ? 'Distance below target — flagged for manual confirmation.' : 'Submitted photo appears reused from a prior week.',
      status: 'pending' as const,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Dashboard-only mock series (transactions, referrals, coupons)
// ---------------------------------------------------------------------------

const TX_PLANS = ['Hunter Monthly', 'Hunter Annual', 'Guild Pro', 'Guild Pro Annual'];
const TX_METHODS = ['Visa •••• 4242', 'Mastercard •••• 8823', 'UPI', 'Apple Pay', 'PayPal'];
const TX_STATUSES: Transaction['status'][] = ['paid', 'paid', 'paid', 'failed', 'pending', 'refunded', 'paid', 'paid', 'failed', 'paid'];
const TX_USERS = ['Ava Thompson', 'Marcus Lee', 'Priya Sharma', 'Diego Fernandez', 'Grace Kim', 'Noah Williams', 'Liam Carter', 'Sofia Rossi', 'Kenji Sato', 'Amara Okafor'];

export function buildSeedTransactions(): Transaction[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `txn_${5001 + i}`,
    userName: TX_USERS[i],
    plan: TX_PLANS[i % TX_PLANS.length],
    amount: [12, 120, 29, 290][i % 4],
    status: TX_STATUSES[i],
    date: daysAgoIso(i, 10 + i),
    method: TX_METHODS[i % TX_METHODS.length],
  }));
}

export function buildSeedTopReferrers(): TopReferrer[] {
  return [
    { userId: 'usr_1003', userName: 'Priya Sharma', linksSent: 48, signups: 21, paidConversions: 9 },
    { userId: 'usr_1001', userName: 'Ava Thompson', linksSent: 39, signups: 17, paidConversions: 7 },
    { userId: 'usr_1005', userName: 'Grace Kim', linksSent: 31, signups: 12, paidConversions: 5 },
    { userId: 'usr_1002', userName: 'Marcus Lee', linksSent: 24, signups: 9, paidConversions: 3 },
    { userId: 'usr_1007', userName: 'Liam Carter', linksSent: 18, signups: 6, paidConversions: 2 },
  ];
}

export function buildSeedReferralActivity(): ReferralActivity[] {
  const statuses: ReferralActivity['status'][] = ['converted', 'signed_up', 'pending', 'signed_up', 'converted', 'pending', 'signed_up', 'converted'];
  const referrers = ['Priya Sharma', 'Ava Thompson', 'Grace Kim', 'Marcus Lee', 'Priya Sharma', 'Liam Carter', 'Ava Thompson', 'Grace Kim'];
  const referees = ['Oscar Petrova', 'Zoe Malik', 'Hassan Singh', 'Ingrid Novak', 'Leo Ahmadi', 'Nadia Yusuf', 'Felix Larsen', 'Ruby Tanaka'];
  return Array.from({ length: 8 }, (_, i) => ({
    id: `ref_${i}`,
    referrerName: referrers[i],
    refereeName: referees[i],
    status: statuses[i],
    date: daysAgoIso(i, 11),
  }));
}

export function buildSeedCouponActivity(): CouponActivityEntry[] {
  const partners = ['FitGear Co.', 'PulseWear', 'GreenBlend Nutrition', 'FitGear Co.', 'TrailForge', 'PulseWear'];
  const actions: CouponActivityEntry['action'][] = ['redeemed', 'issued', 'redeemed', 'expired', 'issued', 'redeemed'];
  const users = ['Ava Thompson', 'Marcus Lee', 'Priya Sharma', 'Diego Fernandez', 'Grace Kim', 'Noah Williams'];
  return Array.from({ length: 6 }, (_, i) => ({
    id: `cpn_${i}`,
    code: `ARISE-${(3000 + i * 17).toString(36).toUpperCase()}`,
    partner: partners[i],
    userName: users[i],
    action: actions[i],
    date: daysAgoIso(i * 2, 13),
  }));
}

export function buildMrrTrend(days: number): { date: string; value: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const daysBack = days - 1 - i;
    const growth = i * 42;
    const wave = Math.sin(i / 6) * 180;
    return { date: dateLabel(daysBack), value: Math.max(0, Math.round(3200 + growth + wave)) };
  });
}

export function buildDauTrend(days: number): { date: string; value: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const daysBack = days - 1 - i;
    const weekday = new Date(dateLabel(daysBack)).getUTCDay();
    const weekendDip = weekday === 0 || weekday === 6 ? -3 : 0;
    const wave = Math.sin(i / 4) * 2.5;
    return { date: dateLabel(daysBack), value: Math.max(1, Math.round(12 + wave + weekendDip + i * 0.05)) };
  });
}

export function buildStreakDropoff(): { day: number; usersRemaining: number }[] {
  const start = 25;
  return Array.from({ length: 14 }, (_, i) => ({
    day: i + 1,
    usersRemaining: Math.max(1, Math.round(start * Math.pow(0.88, i))),
  }));
}
