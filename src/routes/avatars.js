// src/routes/avatars.js — Avatars list endpoint

import { Router }         from 'express';
import { success, error } from '../utils/response.js';
import * as authService   from '../services/authService.js';

const router = Router();

// ── GET /api/avatars ──────────────────────────────────────
// Returns list of all active avatars
router.get('/', async (req, res, next) => {
  try {
    const avatars = await authService.getAvatars();
    return success(res, { avatars }, 'Avatars fetched successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
