// src/routes/tasks.js — Daily routine + weekly quest endpoints for the logged-in user

import { Router }         from 'express';
import { verifyToken }    from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import * as taskService   from '../services/taskService.js';
import * as streakService from '../services/streakService.js';

const router = Router();

// ── GET /api/tasks/today ──────────────────────────────────
// Daily routine tasks + this week's weekly quests for the
// logged-in user, each with its completion status and XP for
// the current period.
// Header: Authorization: Bearer <access_token>

router.get('/today', verifyToken, async (req, res, next) => {
  try {
    const result = await taskService.getTodayTasks(req.user.id);
    return success(res, result, 'Tasks fetched');
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND')
      return error(res, 'User not found', 404);
    next(err);
  }
});

// ── PUT /api/tasks/:taskId/complete ───────────────────────
// Set (or change) this task's completion status for the
// current period — today for daily tasks, this week for
// weekly quests. Idempotent: resending the same status always
// lands in the same state, and XP is adjusted by the delta
// from whatever the task previously held (no double-counting
// if the user flips PARTIAL -> SKIPPED -> PARTIAL, etc).
//
// COMPLETED is a one-way door: once a task is COMPLETED, no further
// status change is accepted for it (resending COMPLETED again is still
// a no-op success). SKIPPED can be undone, but only via the dedicated
// PUT /:taskId/reopen below — not by sending a status here.
//
// Auth: verifyToken (valid, non-expired access token; 401 otherwise) +
// the account must not be banned (checked inside verifyToken, 403 if so).
// On top of that, the task itself must be on THIS user's list for the
// current period (a task_schedule row must exist for them) — you can't
// complete a task never assigned to you, one targeted at other users, or
// one whose date window hasn't opened/has already closed.
//
// Header: Authorization: Bearer <access_token>
// Body: { status: 'COMPLETED' | 'PARTIAL' | 'SKIPPED' }
// (progress_value isn't sent by the client right now; XP is flat per
// status, not scaled off it. SKIPPED never earns XP and never extends
// the daily streak — see taskService.js#setTaskCompletion.)

router.put('/:taskId/complete', verifyToken, async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status, progress_value } = req.body;

    if (!/^\d+$/.test(String(taskId)))
      return error(res, 'Invalid task id', 400);

    if (!['COMPLETED', 'PARTIAL', 'SKIPPED'].includes(status))
      return error(res, 'status must be COMPLETED, PARTIAL, or SKIPPED', 400);

    if (
      progress_value !== undefined && progress_value !== null &&
      (typeof progress_value !== 'number' || !Number.isFinite(progress_value) || progress_value < 0)
    )
      return error(res, 'progress_value must be a non-negative number', 400);

    const result = await taskService.setTaskCompletion(req.user.id, taskId, {
      status,
      progressValue: progress_value,
    });

    return success(res, result, 'Task updated');

  } catch (err) {
    if (err.message === 'TASK_NOT_FOUND')
      return error(res, 'Task not found', 404);
    if (err.message === 'TASK_NOT_ASSIGNED')
      return error(res, 'This task is not assigned to you for the current period', 403);
    if (err.message === 'TASK_ALREADY_COMPLETED')
      return error(res, 'This task is already completed and cannot be changed', 400);
    if (err.message === 'PARTIAL_NOT_ALLOWED')
      return error(res, 'This task does not support partial completion', 400);
    if (err.message === 'INVALID_STATUS')
      return error(res, 'Invalid status', 400);
    if (err.message === 'INVALID_PROGRESS_VALUE')
      return error(res, 'progress_value must be a non-negative number', 400);
    next(err);
  }
});

// ── PUT /api/tasks/:taskId/reopen ─────────────────────────
// Undo a SKIPPED task back to PENDING — the only direction this
// goes. Fails if the task isn't currently SKIPPED (already
// PENDING, PARTIAL, or COMPLETED — COMPLETED is permanently
// locked, see PUT /:taskId/complete above). No XP or streak
// side effects: a skip never earned XP or touched the streak in
// the first place.
// Header: Authorization: Bearer <access_token>

router.put('/:taskId/reopen', verifyToken, async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!/^\d+$/.test(String(taskId)))
      return error(res, 'Invalid task id', 400);

    const result = await taskService.reopenTask(req.user.id, taskId);
    return success(res, result, 'Task reopened');

  } catch (err) {
    if (err.message === 'TASK_NOT_FOUND')
      return error(res, 'Task not found', 404);
    if (err.message === 'TASK_NOT_ASSIGNED')
      return error(res, 'This task is not assigned to you for the current period', 403);
    if (err.message === 'TASK_NOT_SKIPPED')
      return error(res, 'Only a skipped task can be reopened', 400);
    if (err.message === 'TASK_ALREADY_PENDING')
      return error(res, 'This task is already pending', 400);
    next(err);
  }
});

// ── POST /api/tasks/streak/resolve ────────────────────────
// Answers the "your streak is at risk — use a life or let it
// drop?" prompt (shown when GET /today's streak.at_risk is
// true). USE_LIVES spends streak.missed_days lives and forgives
// the gap — the streak keeps counting normally next time the
// user completes a daily task. DROP breaks the streak to 0
// immediately instead of waiting for it to lazily reset on next
// completion. Does nothing to XP either way.
// Header: Authorization: Bearer <access_token>
// Body: { action: 'USE_LIVES' | 'DROP' }

router.post('/streak/resolve', verifyToken, async (req, res, next) => {
  try {
    const { action } = req.body;

    if (!['USE_LIVES', 'DROP'].includes(action))
      return error(res, "action must be 'USE_LIVES' or 'DROP'", 400);

    const result = await streakService.resolveStreakRisk(req.user.id, action);
    return success(res, result, action === 'USE_LIVES' ? 'Streak saved' : 'Streak dropped');

  } catch (err) {
    if (err.message === 'NOTHING_TO_RESOLVE')
      return error(res, 'No at-risk streak to resolve right now', 400);
    if (err.message === 'INVALID_ACTION')
      return error(res, "action must be 'USE_LIVES' or 'DROP'", 400);
    next(err);
  }
});

export default router;
