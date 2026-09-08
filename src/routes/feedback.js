// src/routes/feedback.js — "Send Feedback" screen
//
// Every response here is user-facing — see feedbackService.js for the
// shape returned. Discord is purely internal (discordService.js) and
// never surfaces through any endpoint here.

import { Router }          from 'express';
import { verifyToken }     from '../middleware/auth.js';
import { success, error }  from '../utils/response.js';
import * as feedbackService from '../services/feedbackService.js';

const router = Router();

// ── POST /api/feedback ────────────────────────────────────
// Protected. Saves the submission first; the Discord ping is best-effort
// and can never fail this response (see feedbackService.submitFeedback).
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { category, message, attachmentUrl, allowFollowup, app_version, device_os } = req.body || {};

    const { feedbackId, status } = await feedbackService.submitFeedback(req.user, {
      category,
      message,
      attachmentUrl,
      allowFollowup,
      app_version,
      device_os,
    });

    return res.status(201).json({ success: true, feedbackId, status });
  } catch (err) {
    const badRequest = {
      INVALID_CATEGORY: `category must be one of: ${feedbackService.FEEDBACK_CATEGORIES.join(', ')}`,
      MESSAGE_REQUIRED: 'message is required',
      MESSAGE_TOO_LONG: 'message cannot exceed 1000 characters',
    };
    if (badRequest[err.message]) return error(res, badRequest[err.message], 400);
    next(err);
  }
});

// ── GET /api/feedback/mine ─────────────────────────────────
// Protected. The only feedback data ever exposed to a user — their own
// submissions, newest first.
router.get('/mine', verifyToken, async (req, res, next) => {
  try {
    const feedback = await feedbackService.getMyFeedback(req.user.id);
    return success(res, { feedback });
  } catch (err) {
    next(err);
  }
});

export default router;
