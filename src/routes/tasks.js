// src/routes/tasks.js — Daily routine + weekly quest endpoints for the logged-in user

import { Router }         from 'express';
import { verifyToken }    from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import * as taskService   from '../services/taskService.js';

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
// weekly quests. Idempotent: resending the same body always
// lands in the same state, and XP is adjusted by the delta
// from whatever the task previously held (no double-counting
// if the user flips COMPLETED -> PARTIAL -> SKIPPED, etc).
// Header: Authorization: Bearer <access_token>
// Body: { status: 'COMPLETED' | 'PARTIAL' | 'SKIPPED', progress_value?: number }

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
    if (err.message === 'PARTIAL_NOT_ALLOWED')
      return error(res, 'This task does not support partial completion', 400);
    if (err.message === 'INVALID_STATUS')
      return error(res, 'Invalid status', 400);
    if (err.message === 'INVALID_PROGRESS_VALUE')
      return error(res, 'progress_value must be a non-negative number', 400);
    next(err);
  }
});

export default router;
