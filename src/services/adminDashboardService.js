// src/services/adminDashboardService.js — Admin "Dashboard" screen: KPI
// cards, subscription/referral/coupon overviews, trend charts, and the
// "needs attention" feed. One exported function per /admin/dashboard/*
// route in src/routes/admin.js.
//
// Response keys are camelCase throughout (totalUsers, newSubsToday, ...) —
// unlike adminUserService/adminTaskService, which return snake_case for
// their own routes. There is no transform layer between this backend and
// the admin frontend, and the frontend's dashboard types (types/dashboard.ts)
// are camelCase, so these functions build their response objects in that
// shape directly rather than relying on a mapper.
//
// IST date/range handling reuses the exact conventions from
// adminUserService.js: getISTDateOnly()/parseDateOnly() from
// ../utils/helpers.js for calendar-day math, and a local
// istDateToUtcInstant() to convert an IST calendar date into the UTC
// instant range Prisma needs for querying real timestamptz columns
// (created_at, started_at, cancelled_at, assigned_at, ...). Columns that
// are themselves @db.Date (last_active_date, schedule_date) are compared
// directly against the IST-midnight Date getISTDateOnly() returns, same
// as adminUserService.getUserStats() does for last_active_date.

import prisma from '../config/prisma.js';
import { getISTDateOnly } from '../utils/helpers.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MS_PER_DAY     = 24 * 60 * 60 * 1000;

function istDateToUtcInstant(istDate) {
  return new Date(istDate.getTime() - IST_OFFSET_MS);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

// getISTDateOnly() already returns a UTC-midnight Date encoding the IST
// calendar date, so slicing its ISO string gives the right 'YYYY-MM-DD'.
function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

// Day-over-day percent change, guarded against divide-by-zero (returns 0
// instead of Infinity/NaN when there's nothing to compare against).
// Rounded to a whole percent, matching adminUserService's Math.round use.
function pctChange(curr, prev) {
  if (!prev) return 0;
  return Math.round(((curr - prev) / prev) * 100);
}

// Bounds/validates a ?days= query param, defaulting when absent/invalid.
function parseDays(query, defaultValue, max = 365) {
  const parsed = parseInt(query?.days, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, max);
}

const PAID_STATUSES = ['ACTIVE', 'TRIAL'];

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/kpis — the 6 summary cards at the top of the
// Dashboard page, each with a day-over-day delta (today vs yesterday,
// IST calendar days).
// ─────────────────────────────────────────────────────────────

export async function getCoreKpis() {
  const today     = getISTDateOnly();
  const yesterday = getISTDateOnly(-1);

  const todayStart     = istDateToUtcInstant(today);
  const tomorrowStart  = istDateToUtcInstant(addDays(today, 1));
  const yesterdayStart = istDateToUtcInstant(yesterday);

  const [
    totalUsers,
    totalUsersAsOfYesterday,
    newSignupsToday,
    newSignupsYesterday,
    activeToday,
    activeYesterday,
    activeSubscriptions,
    activeSubscriptionsAsOfYesterday,
    tasksCompletedToday,
    tasksCompletedYesterday,
    openFeedbackTickets,
    openFeedbackAsOfYesterday,
  ] = await Promise.all([
    prisma.users.count(),
    prisma.users.count({ where: { created_at: { lt: todayStart } } }),
    prisma.users.count({ where: { created_at: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.users.count({ where: { created_at: { gte: yesterdayStart, lt: todayStart } } }),
    prisma.user_progression.count({ where: { last_active_date: today } }),
    prisma.user_progression.count({ where: { last_active_date: yesterday } }),
    prisma.subscriptions.count({ where: { status: 'ACTIVE' } }),
    // "As of yesterday" proxy: today's ACTIVE count minus subscriptions that
    // only started today (per the brief's suggested approach — there's no
    // subscription status history to query directly).
    prisma.subscriptions.count({ where: { status: 'ACTIVE', started_at: { lt: todayStart } } }),
    prisma.task_completions.count({ where: { schedule_date: today } }),
    prisma.task_completions.count({ where: { schedule_date: yesterday } }),
    prisma.feedback.count({ where: { status: { not: 'resolved' } } }),
    // "Open as of yesterday": created before today, and either still open
    // now or only resolved/touched today (updated_at moves whenever status
    // changes, so updated_at >= today means yesterday's snapshot had it open).
    prisma.feedback.count({
      where: {
        created_at: { lt: todayStart },
        OR: [{ status: { not: 'resolved' } }, { updated_at: { gte: todayStart } }],
      },
    }),
  ]);

  return {
    totalUsers,
    activeToday,
    newSignupsToday,
    activeSubscriptions,
    tasksCompletedToday,
    openFeedbackTickets,
    totalUsersDelta:            pctChange(totalUsers, totalUsersAsOfYesterday),
    activeTodayDelta:           pctChange(activeToday, activeYesterday),
    newSignupsTodayDelta:       pctChange(newSignupsToday, newSignupsYesterday),
    activeSubscriptionsDelta:   pctChange(activeSubscriptions, activeSubscriptionsAsOfYesterday),
    tasksCompletedTodayDelta:   pctChange(tasksCompletedToday, tasksCompletedYesterday),
    openFeedbackTicketsDelta:   pctChange(openFeedbackTickets, openFeedbackAsOfYesterday),
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/subscriptions — subscription overview card.
// mrr and trialToPaidPct are hardcoded to 0 (see comments below) —
// product decision, not a bug: there's no price field and no
// trial-conversion event history anywhere in the schema.
// ─────────────────────────────────────────────────────────────

export async function getSubscriptionOverview() {
  const today     = getISTDateOnly();
  const weekStart = getISTDateOnly(-6);

  const todayStart    = istDateToUtcInstant(today);
  const tomorrowStart = istDateToUtcInstant(addDays(today, 1));
  const weekStartUtc  = istDateToUtcInstant(weekStart);

  const [activeSubscribers, newSubsToday, newSubsWeek, churnedThisWeek, statusGroups] = await Promise.all([
    prisma.subscriptions.count({ where: { status: 'ACTIVE' } }),
    prisma.subscriptions.count({ where: { started_at: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.subscriptions.count({ where: { started_at: { gte: weekStartUtc, lt: tomorrowStart } } }),
    prisma.subscriptions.count({ where: { cancelled_at: { gte: weekStartUtc, lt: tomorrowStart } } }),
    prisma.subscriptions.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return {
    // No price/amount field exists on subscriptions (or anywhere else in
    // the schema) — hardcoded per product decision rather than inventing one.
    mrr: 0,
    activeSubscribers,
    newSubsToday,
    newSubsWeek,
    churnedThisWeek,
    // A subscription row's status is overwritten in place, not logged, so
    // there's no trial->paid conversion *event* history to compute a real
    // rate from — hardcoded per product decision.
    trialToPaidPct: 0,
    statusBreakdown: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/mrr-trend?days=90 — always-zero trend line
// (see getSubscriptionOverview's mrr comment: no price data exists to
// trend). Still returns `days` real, correctly-dated points so the chart
// renders an honest flat line instead of erroring or going blank.
// ─────────────────────────────────────────────────────────────

export async function getMrrTrend(query = {}) {
  const days  = parseDays(query, 90);
  const start = getISTDateOnly(-(days - 1));

  return Array.from({ length: days }, (_, i) => ({
    date:  dateKey(addDays(start, i)),
    value: 0,
  }));
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/dau-trend?days=30 — real daily-active-users
// trend. user_progression.last_active_date only holds each user's most
// recent active day (not a full history log), so "DAU on day X" is
// literally a count of users whose last_active_date equals X — the
// closest real signal the schema offers.
// ─────────────────────────────────────────────────────────────

export async function getDauTrend(query = {}) {
  const days  = parseDays(query, 30);
  const start = getISTDateOnly(-(days - 1));
  const end   = getISTDateOnly();

  const rows = await prisma.user_progression.groupBy({
    by:    ['last_active_date'],
    where: { last_active_date: { gte: start, lte: end } },
    _count: { _all: true },
  });

  const countByDate = new Map(rows.map((r) => [dateKey(r.last_active_date), r._count._all]));

  return Array.from({ length: days }, (_, i) => {
    const key = dateKey(addDays(start, i));
    return { date: key, value: countByDate.get(key) ?? 0 };
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/streak-dropoff — retention curve: for each
// day 1..30, how many users currently have a daily_streak of at least
// that many days. Fixed 30-day window (a "reasonable N" per the brief —
// there's no natural upper bound on daily_streak to size this from).
// ─────────────────────────────────────────────────────────────

const STREAK_DROPOFF_DAYS = 30;

export async function getStreakDropoff() {
  const rows = await prisma.user_progression.groupBy({
    by: ['daily_streak'],
    _count: { _all: true },
  });

  const result = [];
  for (let day = 1; day <= STREAK_DROPOFF_DAYS; day++) {
    const usersRemaining = rows.reduce(
      (sum, r) => sum + (r.daily_streak >= day ? r._count._all : 0),
      0
    );
    result.push({ day, usersRemaining });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/rank-distribution — user count per rank_name,
// via user_progression.current_level -> levels.rank_name (same join
// pattern as adminUserService.listUsers/getRanks). Includes ranks with
// zero current users so the distribution chart shows the full ladder.
// ─────────────────────────────────────────────────────────────

export async function getRankDistribution() {
  const [levels, grouped] = await Promise.all([
    prisma.levels.findMany({ select: { level_number: true, rank_name: true } }),
    prisma.user_progression.groupBy({ by: ['current_level'], _count: { _all: true } }),
  ]);

  const rankByLevel = new Map(levels.map((l) => [l.level_number, l.rank_name]));

  const countByRank = new Map();
  for (const g of grouped) {
    const rank = rankByLevel.get(g.current_level) ?? 'Unknown';
    countByRank.set(rank, (countByRank.get(rank) ?? 0) + g._count._all);
  }

  // Ordered lowest-level-first, same convention as getRanks().
  const orderedRanks = [];
  const seen = new Set();
  for (const l of [...levels].sort((a, b) => a.level_number - b.level_number)) {
    if (l.rank_name && !seen.has(l.rank_name)) {
      seen.add(l.rank_name);
      orderedRanks.push(l.rank_name);
    }
  }

  return orderedRanks.map((rank) => ({ rank, users: countByRank.get(rank) ?? 0 }));
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/transactions?limit=10 — no payment/transaction
// table exists anywhere in the schema. Returns an empty array (200 OK)
// rather than 404ing, per product decision, so the frontend can render
// its "no data" state instead of erroring.
// ─────────────────────────────────────────────────────────────

export async function getRecentTransactions() {
  return [];
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/referrals — referral overview card.
// totalLinksSent has no backing data (referrals only exist once a signup
// has already happened — there's no "link sent" tracking) so it's set
// equal to successfulSignups, per product decision.
// ─────────────────────────────────────────────────────────────

export async function getReferralOverview() {
  const referredRows = await prisma.referrals.findMany({ select: { referred_id: true } });
  const successfulSignups = referredRows.length;

  let referralToPaidPct = 0;
  if (successfulSignups > 0) {
    const referredIds = referredRows.map((r) => r.referred_id);
    const paidUsers = await prisma.subscriptions.findMany({
      where:    { user_id: { in: referredIds }, status: { in: PAID_STATUSES } },
      select:   { user_id: true },
      distinct: ['user_id'],
    });
    referralToPaidPct = Math.round((paidUsers.length / successfulSignups) * 100);
  }

  return {
    totalLinksSent: successfulSignups,
    successfulSignups,
    referralToPaidPct,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/top-referrers — top ~10 referrers by signup
// count, with paid-conversion counts among the users they referred.
// linksSent === signups per referrer (same "no link tracking" reasoning
// as getReferralOverview.totalLinksSent).
// ─────────────────────────────────────────────────────────────

export async function getTopReferrers() {
  const grouped = await prisma.referrals.groupBy({
    by: ['referrer_id'],
    _count: { _all: true },
  });

  grouped.sort((a, b) => b._count._all - a._count._all);
  const top = grouped.slice(0, 10);
  if (top.length === 0) return [];

  const referrerIds = top.map((g) => g.referrer_id);

  const [referrerUsers, referralRows] = await Promise.all([
    prisma.users.findMany({ where: { id: { in: referrerIds } }, select: { id: true, name: true } }),
    prisma.referrals.findMany({
      where:  { referrer_id: { in: referrerIds } },
      select: { referrer_id: true, referred_id: true },
    }),
  ]);

  const allReferredIds = referralRows.map((r) => r.referred_id);
  const paidUsers = allReferredIds.length
    ? await prisma.subscriptions.findMany({
        where:    { user_id: { in: allReferredIds }, status: { in: PAID_STATUSES } },
        select:   { user_id: true },
        distinct: ['user_id'],
      })
    : [];
  const paidUserIds = new Set(paidUsers.map((u) => u.user_id.toString()));

  const nameById = new Map(referrerUsers.map((u) => [u.id.toString(), u.name]));

  const referredByReferrer = new Map();
  for (const row of referralRows) {
    const key = row.referrer_id.toString();
    if (!referredByReferrer.has(key)) referredByReferrer.set(key, []);
    referredByReferrer.get(key).push(row.referred_id.toString());
  }

  return top.map((g) => {
    const key = g.referrer_id.toString();
    const referredIds = referredByReferrer.get(key) ?? [];
    const paidConversions = referredIds.filter((id) => paidUserIds.has(id)).length;
    return {
      userId:   key,
      userName: nameById.get(key) ?? 'Unknown',
      linksSent: g._count._all,
      signups:   g._count._all,
      paidConversions,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/referral-activity — recent referral signups,
// newest first. status is 'converted' when the referred user currently
// holds an ACTIVE/TRIAL subscription, else 'signed_up' — there's no
// distinct 'pending' state in this schema, so it's never emitted.
// ─────────────────────────────────────────────────────────────

export async function getReferralActivity() {
  const rows = await prisma.referrals.findMany({
    orderBy: { created_at: 'desc' },
    take:    20,
    select: {
      id:         true,
      created_at: true,
      users_referrals_referrer_idTousers: { select: { name: true } },
      users_referrals_referred_idTousers: { select: { id: true, name: true } },
    },
  });
  if (rows.length === 0) return [];

  const referredIds = rows.map((r) => r.users_referrals_referred_idTousers.id);
  const paidUsers = await prisma.subscriptions.findMany({
    where:    { user_id: { in: referredIds }, status: { in: PAID_STATUSES } },
    select:   { user_id: true },
    distinct: ['user_id'],
  });
  const paidSet = new Set(paidUsers.map((u) => u.user_id.toString()));

  return rows.map((r) => ({
    id:           r.id.toString(),
    referrerName: r.users_referrals_referrer_idTousers.name,
    refereeName:  r.users_referrals_referred_idTousers.name,
    status:       paidSet.has(r.users_referrals_referred_idTousers.id.toString()) ? 'converted' : 'signed_up',
    date:         r.created_at,
  }));
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/coupons — coupon overview card. "Tier" in
// byTier is reward_partners.name — there's no separate tier concept in
// the schema, so partner doubles as tier per the brief.
// A reward is treated as expired if its status is EXPIRED OR its
// expires_at has already passed (whichever the status hasn't caught up
// to yet), unless it's already been claimed.
// ─────────────────────────────────────────────────────────────

export async function getCouponOverview() {
  const [rewardRows, pools] = await Promise.all([
    prisma.user_rewards.findMany({ select: { pool_id: true, status: true, expires_at: true } }),
    prisma.reward_pool.findMany({
      select: { id: true, reward_partners: { select: { name: true } } },
    }),
  ]);

  const partnerByPool = new Map(pools.map((p) => [p.id.toString(), p.reward_partners?.name ?? 'Unknown']));
  const now = new Date();

  let redeemed = 0;
  let unredeemed = 0;
  let expired = 0;
  const tierMap = new Map();

  for (const r of rewardRows) {
    const tier = partnerByPool.get(r.pool_id.toString()) ?? 'Unknown';
    if (!tierMap.has(tier)) tierMap.set(tier, { tier, used: 0, unused: 0, expired: 0 });
    const bucket = tierMap.get(tier);

    const isExpired = r.status === 'EXPIRED' || (r.expires_at !== null && r.expires_at < now);

    if (r.status === 'CLAIMED') {
      redeemed += 1;
      bucket.used += 1;
    } else if (isExpired) {
      expired += 1;
      bucket.expired += 1;
    } else {
      unredeemed += 1;
      bucket.unused += 1;
    }
  }

  const issued = rewardRows.length;
  const redemptionRatePct = issued === 0 ? 0 : Math.round((redeemed / issued) * 100);

  return {
    issued,
    redeemed,
    unredeemed,
    expired,
    redemptionRatePct,
    byTier: [...tierMap.values()],
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/coupon-activity — recent coupon issue/redeem/
// expire events, newest first. action is taken directly from
// user_rewards.status (CLAIMED -> redeemed, EXPIRED -> expired, else
// issued), per the brief.
// ─────────────────────────────────────────────────────────────

export async function getCouponActivity() {
  const rows = await prisma.user_rewards.findMany({
    orderBy: { assigned_at: 'desc' },
    take:    20,
    select: {
      id:          true,
      status:      true,
      assigned_at: true,
      claimed_at:  true,
      expires_at:  true,
      reward_pool: { select: { coupon_code: true, reward_partners: { select: { name: true } } } },
      users:       { select: { name: true } },
    },
  });

  return rows.map((r) => {
    const action = r.status === 'CLAIMED' ? 'redeemed' : r.status === 'EXPIRED' ? 'expired' : 'issued';
    const date =
      action === 'redeemed' ? (r.claimed_at ?? r.assigned_at) :
      action === 'expired'  ? (r.expires_at ?? r.assigned_at) :
      r.assigned_at;

    return {
      id:      r.id.toString(),
      code:    r.reward_pool.coupon_code,
      partner: r.reward_pool.reward_partners?.name ?? 'Unknown',
      userName: r.users.name,
      action,
      date,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard/needs-attention — merged feed of open
// feedback tickets and banned users, newest first, capped at 10.
// 'gps_review' and 'failed_payment' are never emitted — no GPS-flag or
// payment table exists in the schema to back them.
//
// Banned users have no dedicated "banned at" timestamp (is_banned is a
// plain boolean with no audit column), so updated_at is used as the best
// available proxy for "when banned" — a judgment call, called out in the
// handoff notes.
// ─────────────────────────────────────────────────────────────

const NEEDS_ATTENTION_LIMIT = 10;
const FEEDBACK_PREVIEW_LEN  = 140;

export async function getNeedsAttention() {
  const [feedbackRows, bannedUsers] = await Promise.all([
    prisma.feedback.findMany({
      where:   { status: { not: 'resolved' } },
      orderBy: { created_at: 'desc' },
      take:    NEEDS_ATTENTION_LIMIT,
      select: {
        id: true, message: true, created_at: true,
        users: { select: { name: true } },
      },
    }),
    prisma.users.findMany({
      where:   { is_banned: true },
      orderBy: { updated_at: 'desc' },
      take:    NEEDS_ATTENTION_LIMIT,
      select:  { id: true, name: true, hunter_id: true, updated_at: true, created_at: true },
    }),
  ]);

  const items = [
    ...feedbackRows.map((f) => ({
      id:          `feedback-${f.id}`,
      type:        'feedback_ticket',
      title:       `Feedback from ${f.users?.name ?? 'a user'}`,
      description: f.message.length > FEEDBACK_PREVIEW_LEN
        ? `${f.message.slice(0, FEEDBACK_PREVIEW_LEN)}…`
        : f.message,
      timestamp: f.created_at,
      href:      '/feedback',
    })),
    ...bannedUsers.map((u) => ({
      id:          `banned-${u.id}`,
      type:        'banned_user',
      title:       `${u.name} was banned`,
      description: `Hunter ID ${u.hunter_id} is currently banned`,
      timestamp:   u.updated_at ?? u.created_at,
      href:        `/users/${u.id}`,
    })),
  ];

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, NEEDS_ATTENTION_LIMIT);
}
