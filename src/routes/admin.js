// src/routes/admin.js — Admin-only endpoints

import { Router }            from 'express';
import { verifyToken }       from '../middleware/auth.js';
import { verifyAdmin }       from '../middleware/adminAuth.js';
import { success, error }    from '../utils/response.js';
import * as adminTaskService from '../services/adminTaskService.js';
import * as feedbackService  from '../services/feedbackService.js';
import * as adminUserService from '../services/adminUserService.js';
import * as adminDashboardService from '../services/adminDashboardService.js';

const router = Router();

// Shared between POST /tasks and PUT /tasks/:id — both run the task fields
// through the same validation (adminTaskService.js#buildTaskData).
const TASK_VALIDATION_ERRORS = {
  TITLE_REQUIRED:                      'Title is required',
  INVALID_TASK_TYPE:                   "task_type must be 'DAILY_ADMIN' or 'WEEKLY' (DAILY_FIXED is seed-managed)",
  INVALID_LEVEL_TARGET:                'level_target must be ALL, BEGINNER, INTERMEDIATE, or ADVANCED',
  IS_RECURRING_REQUIRED:               'is_recurring must be true or false',
  INVALID_TARGET_VALUE:                'target_value must be a non-negative number',
  INVALID_XP_REWARD:                   'xp_reward must be a positive integer',
  XP_REWARD_EXCEEDS_CAP:               'xp_reward exceeds the cap for this task type (10 for DAILY_ADMIN, 70 for WEEKLY)',
  INVALID_XP_PARTIAL:                  'xp_partial must be a positive integer when allows_partial is true',
  XP_PARTIAL_MUST_BE_LESS_THAN_REWARD: 'xp_partial must be less than xp_reward',
  RECURRENCE_DAYS_REQUIRED:            'recurrence_days is required for WEEKLY tasks',
  INVALID_RECURRENCE_DAYS:             'recurrence_days must be integers 0 (Sun) to 6 (Sat)',
  START_DATE_REQUIRED:                 'start_date is required',
  INVALID_START_DATE:                  'start_date must be a valid YYYY-MM-DD date',
  START_DATE_IN_PAST:                  'start_date cannot be in the past',
  END_DATE_REQUIRED:                   'end_date is required when is_recurring is true',
  INVALID_END_DATE:                    'end_date must be a valid YYYY-MM-DD date',
  END_DATE_BEFORE_START_DATE:          'end_date cannot be before start_date',
  END_DATE_TOO_SOON:                   'end_date must be at least 6 days after start_date for a recurring WEEKLY task (a full 7-day week)',
  INVALID_TARGET_USER_IDS:             'target_user_ids must be an array of user ids',
};

// ── GET /api/admin/tasks ──────────────────────────────────
// Admin-only. Every task (including the 3 seed-managed DAILY_FIXED
// routines), newest first.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/tasks', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const tasks = await adminTaskService.listTasks();
    return success(res, { tasks }, 'Tasks fetched');
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/tasks ─────────────────────────────────
// Create a DAILY_ADMIN or WEEKLY task, one-time or recurring, on any
// start_date (today or future). DAILY_FIXED isn't creatable here — those
// 3 routine tasks are seed-managed (prisma/seed.js), not admin-authored.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
//
// Common body fields:
//   title, task_type: 'DAILY_ADMIN' | 'WEEKLY',
//   is_recurring: boolean,             // false = one-time, true = repeats
//   start_date: 'YYYY-MM-DD',          // first assignable date, can be future-dated; cannot be in the past
//   end_date?: 'YYYY-MM-DD',           // REQUIRED when is_recurring=true, ignored otherwise (derived instead):
//                                       //   DAILY_ADMIN one-time -> end_date = start_date (single day)
//                                       //   WEEKLY one-time      -> end_date = start_date + 6 (one 7-day window)
//   description?, tag?, image_url?, level_target?,
//   xp_reward?, xp_partial?, allows_partial?,
//   target_value?, target_unit?
//
// DAILY_ADMIN only:
//   target_user_ids?: [12, 47]         // omit/empty = every active user
//
// WEEKLY only:
//   recurrence_days: [1, 3, 5]         // required, 0=Sun..6=Sat, which days within each 7-day window count

router.post('/tasks', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const task = await adminTaskService.createTask(req.user.id, req.body);
    return success(res, { task }, 'Task created', 201);
  } catch (err) {
    if (TASK_VALIDATION_ERRORS[err.message]) return error(res, TASK_VALIDATION_ERRORS[err.message], 400);
    if (err.message === 'TARGET_USER_NOT_FOUND')
      return error(res, 'One or more target_user_ids do not exist', 404);
    next(err);
  }
});

// ── PUT /api/admin/tasks/:id ──────────────────────────────
// Admin-only. Edits an existing DAILY_ADMIN/WEEKLY task — same body
// fields as POST /tasks (task_type included, but it must match the
// existing row; DAILY_FIXED routines aren't editable here).
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.put('/tasks/:id', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const task = await adminTaskService.updateTask(req.params.id, req.body);
    return success(res, { task }, 'Task updated');
  } catch (err) {
    if (err.message === 'INVALID_TASK_ID') return error(res, 'Invalid task id', 400);
    if (err.message === 'TASK_NOT_FOUND') return error(res, 'Task not found', 404);
    if (err.message === 'TASK_NOT_EDITABLE') return error(res, 'DAILY_FIXED tasks are seed-managed and cannot be edited', 400);
    if (err.message === 'TASK_TYPE_IMMUTABLE') return error(res, 'task_type cannot be changed on an existing task', 400);
    if (TASK_VALIDATION_ERRORS[err.message]) return error(res, TASK_VALIDATION_ERRORS[err.message], 400);
    next(err);
  }
});

// ── GET /api/admin/tasks/:id/completions ──────────────────
// Admin-only. Every logged completion for this task, newest first.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/tasks/:id/completions', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const completions = await adminTaskService.getTaskCompletions(req.params.id);
    return success(res, completions, 'Task completions fetched');
  } catch (err) {
    if (err.message === 'INVALID_TASK_ID') return error(res, 'Invalid task id', 400);
    next(err);
  }
});

// ── GET /api/admin/tasks/:id/assignment-stats ─────────────
// Admin-only. Users assigned, completion rate, and average completion
// time for this task.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/tasks/:id/assignment-stats', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const stats = await adminTaskService.getTaskAssignmentStats(req.params.id);
    return success(res, stats, 'Task assignment stats fetched');
  } catch (err) {
    if (err.message === 'INVALID_TASK_ID') return error(res, 'Invalid task id', 400);
    next(err);
  }
});

// ── PATCH /api/admin/feedback/:id/status ──────────────────
// Admin-only. Updates a feedback submission's review status.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.patch('/feedback/:id/status', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const feedback = await feedbackService.updateFeedbackStatus(req.params.id, status);
    return success(res, { feedback }, 'Feedback status updated');
  } catch (err) {
    if (err.message === 'INVALID_STATUS')
      return error(res, `status must be one of: ${feedbackService.FEEDBACK_STATUSES.join(', ')}`, 400);
    if (err.message === 'INVALID_FEEDBACK_ID')
      return error(res, 'Invalid feedback id', 400);
    if (err.message === 'FEEDBACK_NOT_FOUND')
      return error(res, 'Feedback not found', 404);
    next(err);
  }
});

// ── GET /api/admin/users/stats ────────────────────────────
// Admin-only. The 4 summary cards above the Users table (total users,
// active today, avg level, avg streak) — always whole-roster, unaffected
// by the table's own filters below.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/users/stats', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const stats = await adminUserService.getUserStats();
    return success(res, { stats }, 'User stats fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/ranks ────────────────────────────
// Admin-only. Distinct rank list for the "All Ranks" filter dropdown,
// ordered lowest-level-first.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/users/ranks', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const ranks = await adminUserService.getRanks();
    return success(res, { ranks }, 'Ranks fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users ──────────────────────────────────
// Admin-only. Search/filter/paginate the user roster.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
// Query: search?, rank?, level? ("1-10"), status? (ACTIVE|BANNED),
//        date_preset? (7d|30d|90d|all), start_date?, end_date? (YYYY-MM-DD),
//        sort_by? (signup_date|name|level|streak), page?, limit? (max 100)
router.get('/users', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const data = await adminUserService.listUsers(req.query);
    return success(res, data, 'Users fetched');
  } catch (err) {
    const badRequest = {
      INVALID_STATUS:          `status must be one of: ${['ACTIVE', 'BANNED'].join(', ')}`,
      INVALID_RANK:             'Unknown rank',
      INVALID_LEVEL_RANGE:      "level must be a range like '1-10'",
      INVALID_SORT_BY:          'sort_by must be one of: signup_date, name, level, streak',
      INVALID_DATE_PRESET:      'date_preset must be one of: 7d, 30d, 90d, all',
      INVALID_START_DATE:       'start_date must be a valid YYYY-MM-DD date',
      INVALID_END_DATE:         'end_date must be a valid YYYY-MM-DD date',
      START_AFTER_END_DATE:     'start_date cannot be after end_date',
    };
    if (badRequest[err.message]) return error(res, badRequest[err.message], 400);
    next(err);
  }
});

// ── PATCH /api/admin/users/:id/ban ────────────────────────
// Admin-only. Body: { reason?: string }
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.patch('/users/:id/ban', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const user = await adminUserService.banUser(req.params.id, req.body?.reason);
    return success(res, { user }, 'User banned');
  } catch (err) {
    if (err.message === 'INVALID_USER_ID') return error(res, 'Invalid user id', 400);
    if (err.message === 'USER_NOT_FOUND') return error(res, 'User not found', 404);
    next(err);
  }
});

// ── PATCH /api/admin/users/:id/unban ──────────────────────
// Admin-only.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.patch('/users/:id/unban', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const user = await adminUserService.unbanUser(req.params.id);
    return success(res, { user }, 'User unbanned');
  } catch (err) {
    if (err.message === 'INVALID_USER_ID') return error(res, 'Invalid user id', 400);
    if (err.message === 'USER_NOT_FOUND') return error(res, 'User not found', 404);
    next(err);
  }
});

// ── POST /api/admin/users/:id/xp-adjustment ───────────────
// Admin-only. Body: { delta: number (non-zero integer), reason: string }
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.post('/users/:id/xp-adjustment', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const { delta, reason } = req.body || {};
    const user = await adminUserService.adjustUserXp(req.params.id, delta, reason);
    return success(res, { user }, 'XP adjusted');
  } catch (err) {
    if (err.message === 'INVALID_USER_ID') return error(res, 'Invalid user id', 400);
    if (err.message === 'USER_NOT_FOUND') return error(res, 'User not found', 404);
    if (err.message === 'INVALID_DELTA') return error(res, 'delta must be a non-zero integer', 400);
    if (err.message === 'REASON_REQUIRED') return error(res, 'reason is required', 400);
    next(err);
  }
});

// ── POST /api/admin/users/:id/reset-streak ────────────────
// Admin-only. Zeroes the user's current daily streak.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.post('/users/:id/reset-streak', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const user = await adminUserService.resetUserStreak(req.params.id);
    return success(res, { user }, 'Streak reset');
  } catch (err) {
    if (err.message === 'INVALID_USER_ID') return error(res, 'Invalid user id', 400);
    if (err.message === 'USER_NOT_FOUND') return error(res, 'User not found', 404);
    next(err);
  }
});

// ── GET /api/admin/dashboard/kpis ─────────────────────────
// Admin-only. The 6 summary cards at the top of the Dashboard page,
// each with a day-over-day delta (today vs yesterday, IST calendar days).
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/kpis', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const kpis = await adminDashboardService.getCoreKpis();
    return success(res, kpis, 'KPIs fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/subscriptions ────────────────
// Admin-only. Subscription overview card. mrr/trialToPaidPct are always 0
// — no price field or trial-conversion history exists in the schema.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/subscriptions', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const overview = await adminDashboardService.getSubscriptionOverview();
    return success(res, overview, 'Subscription overview fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/mrr-trend?days=90 ────────────
// Admin-only. Always-zero trend line (see subscriptions.mrr) — still
// returns `days` real, correctly-dated points.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/mrr-trend', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const trend = await adminDashboardService.getMrrTrend(req.query);
    return success(res, trend, 'MRR trend fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/dau-trend?days=30 ────────────
// Admin-only. Real daily-active-users trend from user_progression.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/dau-trend', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const trend = await adminDashboardService.getDauTrend(req.query);
    return success(res, trend, 'DAU trend fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/streak-dropoff ───────────────
// Admin-only. Retention curve: users remaining at each streak-day
// threshold, 1-30.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/streak-dropoff', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const dropoff = await adminDashboardService.getStreakDropoff();
    return success(res, dropoff, 'Streak dropoff fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/rank-distribution ────────────
// Admin-only. User count per rank, full ladder including zero-user ranks.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/rank-distribution', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const distribution = await adminDashboardService.getRankDistribution();
    return success(res, distribution, 'Rank distribution fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/transactions?limit=10 ────────
// Admin-only. No payment/transaction table exists in the schema — always
// returns an empty array (200, not 404) so the frontend renders its
// "no data" state.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/transactions', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const transactions = await adminDashboardService.getRecentTransactions();
    return success(res, transactions, 'Transactions fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/referrals ────────────────────
// Admin-only. Referral overview card. totalLinksSent === successfulSignups
// — there's no "link sent" tracking, only completed signups.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/referrals', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const overview = await adminDashboardService.getReferralOverview();
    return success(res, overview, 'Referral overview fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/top-referrers ────────────────
// Admin-only. Top ~10 referrers by signup count, with paid-conversion
// counts among referred users.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/top-referrers', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const referrers = await adminDashboardService.getTopReferrers();
    return success(res, referrers, 'Top referrers fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/referral-activity ────────────
// Admin-only. Recent referral signups, newest first.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/referral-activity', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const activity = await adminDashboardService.getReferralActivity();
    return success(res, activity, 'Referral activity fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/coupons ──────────────────────
// Admin-only. Coupon overview card, from reward_pool/user_rewards.
// "Tier" in byTier is the reward partner name.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/coupons', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const overview = await adminDashboardService.getCouponOverview();
    return success(res, overview, 'Coupon overview fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/coupon-activity ──────────────
// Admin-only. Recent coupon issue/redeem/expire events, newest first.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/coupon-activity', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const activity = await adminDashboardService.getCouponActivity();
    return success(res, activity, 'Coupon activity fetched');
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/dashboard/needs-attention ──────────────
// Admin-only. Merged feed of open feedback tickets and banned users,
// newest first, capped at 10.
// Header: Authorization: Bearer <access_token>  (role must be ADMIN)
router.get('/dashboard/needs-attention', verifyToken, verifyAdmin, async (req, res, next) => {
  try {
    const items = await adminDashboardService.getNeedsAttention();
    return success(res, items, 'Needs-attention feed fetched');
  } catch (err) {
    next(err);
  }
});

export default router;
