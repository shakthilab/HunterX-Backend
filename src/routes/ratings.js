// src/routes/ratings.js — "Rate HunterX" endpoint

import { Router }        from 'express';
import { verifyToken }   from '../middleware/auth.js';
import { error }         from '../utils/response.js';
import * as ratingService from '../services/ratingService.js';

const router = Router();

// ── POST /api/ratings ─────────────────────────────────────
// Protected. Upserts the caller's ONE current rating (not a log) — a
// resubmission always overwrites the previous rating, never rate-limited.
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { stars, category, comment, app_version, device_os } = req.body || {};

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return error(res, 'stars is required and must be an integer between 1 and 5', 400);
    }

    if (category !== undefined && category !== null && !ratingService.RATING_CATEGORIES.includes(category)) {
      return error(res, `category must be one of: ${ratingService.RATING_CATEGORIES.join(', ')}`, 400);
    }

    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string') {
        return error(res, 'comment must be a string', 400);
      }
      if (comment.length > 1000) {
        return error(res, 'comment cannot exceed 1000 characters', 400);
      }
    }

    const { promptStoreReview } = await ratingService.submitRating(req.user.id, {
      stars,
      category: category ?? null,
      comment:  comment ?? null,
      app_version,
      device_os,
    });

    return res.status(200).json({ success: true, promptStoreReview });
  } catch (err) {
    next(err);
  }
});

export default router;
