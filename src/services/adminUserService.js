// src/services/adminUserService.js — Admin "Users" screen: search/filter/
// paginate the roster, the summary stat cards above it, and the filter
// option lists (ranks) the frontend renders as dropdowns.
//
// "Rank" here is levels.rank_name (DORMANT/HOLLOW/PHANTOM/...), reached via
// user_progression.current_level -> levels.level_number — there is no rank
// column on users itself. "Status" is derived, not stored: BANNED when
// users.is_banned, ACTIVE otherwise (no separate INACTIVE tier — see
// README note in the PR/handoff for why, and ping if you want one added).

import prisma from '../config/prisma.js';
import { parseDateOnly, getISTDateOnly } from '../utils/helpers.js';
import { checkLevelUp } from './xpService.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MS_PER_DAY     = 24 * 60 * 60 * 1000;

const STATUSES     = ['ACTIVE', 'BANNED'];
const DATE_PRESETS  = { '7d': 7, '30d': 30, '90d': 90 };
const SORTABLE      = {
  signup_date: { created_at: 'desc' },
  name:        { name: 'asc' },
  level:       { user_progression: { current_level: 'desc' } },
  streak:      { user_progression: { daily_streak: 'desc' } },
};

// getISTDateOnly() returns a Date holding the IST calendar date at UTC
// midnight (a display/comparison convention, not a real instant). users.
// created_at is a real timestamptz, so "00:00 IST on that calendar date"
// has to be converted back to the actual UTC instant it occurred at.
function istDateToUtcInstant(istDate) {
  return new Date(istDate.getTime() - IST_OFFSET_MS);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

// Resolves the created_at range for either a named preset or an explicit
// start_date/end_date pair (the latter wins if both are somehow passed).
// Returns null when no date filter applies at all.
function resolveDateRange({ datePreset, startDate, endDate }) {
  if (startDate || endDate) {
    const start = startDate ? parseDateOnly(startDate) : null;
    const end   = endDate ? parseDateOnly(endDate) : null;
    if (startDate && !start) throw new Error('INVALID_START_DATE');
    if (endDate && !end) throw new Error('INVALID_END_DATE');
    if (start && end && start.getTime() > end.getTime()) throw new Error('START_AFTER_END_DATE');

    return {
      gte: start ? istDateToUtcInstant(start) : undefined,
      lt:  end ? istDateToUtcInstant(addDays(end, 1)) : undefined,
    };
  }

  if (!datePreset || datePreset === 'all') return null;

  const days = DATE_PRESETS[datePreset];
  if (!days) throw new Error('INVALID_DATE_PRESET');

  const today = getISTDateOnly();
  return {
    gte: istDateToUtcInstant(getISTDateOnly(-(days - 1))),
    lt:  istDateToUtcInstant(addDays(today, 1)),
  };
}

// "1-10" -> { gte: 1, lte: 10 }. Order-independent (accepts "10-1" too).
function parseLevelRange(level) {
  const match = /^(\d+)\s*-\s*(\d+)$/.exec(String(level).trim());
  if (!match) throw new Error('INVALID_LEVEL_RANGE');
  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);
  return { gte: Math.min(a, b), lte: Math.max(a, b) };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users/ranks — distinct rank list for the "All Ranks"
// dropdown, ordered the way ranks are actually reached (lowest level
// first) rather than alphabetically.
// ─────────────────────────────────────────────────────────────

export async function getRanks() {
  const rows = await prisma.levels.findMany({
    where:   { rank_name: { not: null } },
    select:  { rank_name: true },
    orderBy: { level_number: 'asc' },
  });

  const seen  = new Set();
  const ranks = [];
  for (const { rank_name } of rows) {
    if (!seen.has(rank_name)) {
      seen.add(rank_name);
      ranks.push(rank_name);
    }
  }
  return ranks;
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users/stats — the four summary cards above the table.
// Always computed over the whole roster (unaffected by the table's
// search/filters), matching the "at a glance" role those cards play.
// ─────────────────────────────────────────────────────────────

export async function getUserStats() {
  const today = getISTDateOnly();

  const [totalUsers, activeToday, aggregates] = await Promise.all([
    prisma.users.count(),
    prisma.user_progression.count({ where: { last_active_date: today } }),
    prisma.user_progression.aggregate({
      _avg: { current_level: true, daily_streak: true },
    }),
  ]);

  return {
    total_users: totalUsers,
    active_today: activeToday,
    avg_level:  Math.round(aggregates._avg.current_level ?? 0),
    avg_streak: Math.round(aggregates._avg.daily_streak ?? 0),
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users — the filterable, paginated roster table.
//
// Query params (all optional):
//   search        — matches hunter_id, name, or email (case-insensitive)
//   rank           — a levels.rank_name value, e.g. "PREDATOR"
//   level          — a range string, e.g. "1-10", "20-30"
//   status         — 'ACTIVE' | 'BANNED'
//   date_preset    — '7d' | '30d' | '90d' | 'all'  (signup date, IST)
//   start_date/end_date — 'YYYY-MM-DD', inclusive custom range; overrides
//                    date_preset when either is given
//   sort_by        — 'signup_date' (default) | 'name' | 'level' | 'streak'
//   page, limit    — pagination (default 1 / 20, limit capped at 100)
// ─────────────────────────────────────────────────────────────

export async function listUsers(query = {}) {
  const {
    search,
    rank,
    level,
    status,
    date_preset: datePreset,
    start_date:  startDate,
    end_date:    endDate,
    sort_by:     sortBy = 'signup_date',
  } = query;

  const page  = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  const where = {};

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { hunter_id: { contains: term, mode: 'insensitive' } },
      { name:      { contains: term, mode: 'insensitive' } },
      { email:     { contains: term, mode: 'insensitive' } },
    ];
  }

  if (status) {
    const normalized = status.toUpperCase();
    if (!STATUSES.includes(normalized)) throw new Error('INVALID_STATUS');
    where.is_banned = normalized === 'BANNED';
  }

  // Both `rank` and `level` narrow user_progression.current_level — when
  // both are given, intersect them into one gte/lte/in filter rather than
  // letting a second assignment clobber the first.
  let currentLevelFilter = null;

  if (rank) {
    const levelsForRank = await prisma.levels.findMany({
      where:  { rank_name: rank },
      select: { level_number: true },
    });
    if (levelsForRank.length === 0) throw new Error('INVALID_RANK');
    currentLevelFilter = { in: levelsForRank.map((l) => l.level_number) };
  }

  if (level) {
    const range = parseLevelRange(level); // throws INVALID_LEVEL_RANGE
    currentLevelFilter = currentLevelFilter
      ? { in: (currentLevelFilter.in ?? []).filter((n) => n >= range.gte && n <= range.lte) }
      : range;
  }

  if (currentLevelFilter) {
    where.user_progression = { current_level: currentLevelFilter };
  }

  const dateRange = resolveDateRange({ datePreset, startDate, endDate }); // throws INVALID_*_DATE
  if (dateRange) where.created_at = dateRange;

  const orderBy = SORTABLE[sortBy];
  if (!orderBy) throw new Error('INVALID_SORT_BY');

  const [total, users, levels] = await Promise.all([
    prisma.users.count({ where }),
    prisma.users.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id:         true,
        hunter_id:  true,
        name:       true,
        email:      true,
        is_banned:  true,
        created_at: true,
        avatars:    { select: { image_url: true } },
        auth_providers: { select: { provider: true } },
        user_progression: {
          select: { current_level: true, daily_streak: true, longest_streak: true },
        },
      },
    }),
    // Small, rarely-changing table (100 rows) — fetched once per page to
    // map current_level -> rank_name without a raw join.
    prisma.levels.findMany({ select: { level_number: true, rank_name: true } }),
  ]);

  const rankByLevel = new Map(levels.map((l) => [l.level_number, l.rank_name]));

  const items = users.map((u) => ({
    id:              u.id.toString(),
    hunter_id:       u.hunter_id,
    name:            u.name,
    email:           u.email,
    avatar_url:      u.avatars?.image_url ?? null,
    level:           u.user_progression?.current_level ?? 1,
    rank:            rankByLevel.get(u.user_progression?.current_level ?? 1) ?? null,
    streak:          u.user_progression?.daily_streak ?? 0,
    longest_streak:  u.user_progression?.longest_streak ?? 0,
    status:          u.is_banned ? 'BANNED' : 'ACTIVE',
    signup_date:     u.created_at,
    auth_providers:  u.auth_providers.map((p) => p.provider),
  }));

  return {
    users: items,
    pagination: {
      page,
      limit,
      total_count: total,
      total_pages: Math.ceil(total / limit) || 0,
      has_next_page: page * limit < total,
    },
  };
}

function toBigIntId(id) {
  try {
    return BigInt(id);
  } catch {
    throw new Error('INVALID_USER_ID');
  }
}

// Row shape returned by the moderation actions below — the same fields as
// a listUsers() item, plus the extra detail the Users detail page's Actions
// panel needs (xp, dragon stage, body stats, ban reason). Kept as one raw
// snake_case shape (mapped to the frontend's User type client-side) rather
// than a bespoke response per action.
async function loadUserDetailRow(id) {
  const user = await prisma.users.findUnique({
    where:  { id },
    select: {
      id:         true,
      hunter_id:  true,
      name:       true,
      email:      true,
      is_banned:  true,
      ban_reason: true,
      created_at: true,
      dragon_stage: true,
      height_cm:  true,
      weight_kg:  true,
      bmi:        true,
      avatars:    { select: { image_url: true } },
      auth_providers: { select: { provider: true } },
      user_progression: {
        select: { current_level: true, total_xp: true, daily_streak: true, longest_streak: true },
      },
    },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  const currentLevel = user.user_progression?.current_level ?? 1;
  const levelRow = await prisma.levels.findUnique({
    where:  { level_number: currentLevel },
    select: { rank_name: true },
  });

  return {
    id:              user.id.toString(),
    hunter_id:       user.hunter_id,
    name:            user.name,
    email:           user.email,
    avatar_url:      user.avatars?.image_url ?? null,
    level:           currentLevel,
    rank:            levelRow?.rank_name ?? null,
    xp:              user.user_progression?.total_xp ?? 0,
    streak:          user.user_progression?.daily_streak ?? 0,
    longest_streak:  user.user_progression?.longest_streak ?? 0,
    dragon_stage:    user.dragon_stage,
    height_cm:       user.height_cm,
    weight_kg:       user.weight_kg,
    bmi:             user.bmi,
    status:          user.is_banned ? 'BANNED' : 'ACTIVE',
    ban_reason:      user.ban_reason,
    signup_date:     user.created_at,
    auth_providers:  user.auth_providers.map((p) => p.provider),
  };
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/ban — set is_banned + record why.
// ─────────────────────────────────────────────────────────────

export async function banUser(userId, reason) {
  const id = toBigIntId(userId);
  try {
    await prisma.users.update({
      where: { id },
      data:  { is_banned: true, ban_reason: reason?.trim() || null },
    });
  } catch (err) {
    if (err.code === 'P2025') throw new Error('USER_NOT_FOUND');
    throw err;
  }
  return loadUserDetailRow(id);
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/unban
// ─────────────────────────────────────────────────────────────

export async function unbanUser(userId) {
  const id = toBigIntId(userId);
  try {
    await prisma.users.update({
      where: { id },
      data:  { is_banned: false, ban_reason: null },
    });
  } catch (err) {
    if (err.code === 'P2025') throw new Error('USER_NOT_FOUND');
    throw err;
  }
  return loadUserDetailRow(id);
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/xp-adjustment — manual XP grant/deduction,
// logged to xp_transactions (task_id null = admin-originated) and run
// through the same level-up detection a task completion would trigger.
// Body: { delta: number (non-zero integer), reason: string }
// ─────────────────────────────────────────────────────────────

export async function adjustUserXp(userId, delta, reason) {
  const id = toBigIntId(userId);

  if (!Number.isInteger(delta) || delta === 0) throw new Error('INVALID_DELTA');
  if (!reason?.trim()) throw new Error('REASON_REQUIRED');

  await prisma.$transaction(async (tx) => {
    const progression = await tx.user_progression.findUnique({ where: { user_id: id } });
    if (!progression) throw new Error('USER_NOT_FOUND');

    const newTotal = Math.max(0, progression.total_xp + delta);
    await tx.user_progression.update({
      where: { user_id: id },
      data:  { total_xp: newTotal },
    });

    await tx.xp_transactions.create({
      data: { user_id: id, task_id: null, amount: delta, reason: reason.trim() },
    });

    if (newTotal > progression.total_xp) await checkLevelUp(tx, id);
  });

  return loadUserDetailRow(id);
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/reset-streak — zeroes the current daily
// streak (mirrors how a naturally broken streak resets it; see
// streakService.js#resolveStreakRisk). longest_streak is a historical
// record and is left untouched, matching the confirm-dialog copy.
// ─────────────────────────────────────────────────────────────

export async function resetUserStreak(userId) {
  const id = toBigIntId(userId);
  try {
    await prisma.user_progression.update({
      where: { user_id: id },
      data:  { daily_streak: 0, consecutive_miss_days: 0 },
    });
  } catch (err) {
    if (err.code === 'P2025') throw new Error('USER_NOT_FOUND');
    throw err;
  }
  return loadUserDetailRow(id);
}
