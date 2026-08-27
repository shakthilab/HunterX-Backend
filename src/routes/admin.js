// src/routes/admin.js — Admin-only endpoints

import { Router }            from 'express';
import { verifyToken }       from '../middleware/auth.js';
import { verifyAdmin }       from '../middleware/adminAuth.js';
import { success, error }    from '../utils/response.js';
import * as adminTaskService from '../services/adminTaskService.js';

const router = Router();

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
    const badRequest = {
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
    if (badRequest[err.message]) return error(res, badRequest[err.message], 400);
    if (err.message === 'TARGET_USER_NOT_FOUND')
      return error(res, 'One or more target_user_ids do not exist', 404);
    next(err);
  }
});

export default router;
