// src/routes/users.js — User profile and user management endpoints

import { Router }         from 'express';
import { verifyToken }    from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import * as authService   from '../services/authService.js';
import * as taskService   from '../services/taskService.js';
import * as userSettingsService from '../services/userSettingsService.js';

const router = Router();

// Handler for profile updates
const handleUpdateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateUserProfile(req.user.id, req.body);
    return success(res, { user }, 'Profile updated successfully');
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND')
      return error(res, 'User not found', 404);
    if (err.message === 'INVALID_NAME')
      return error(res, 'Name cannot be empty', 400);
    if (err.message === 'NAME_TOO_LONG')
      return error(res, 'Name cannot exceed 100 characters', 400);
    if (err.message === 'INVALID_GENDER')
      return error(res, 'Gender must be one of: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY', 400);
    if (err.message === 'INVALID_BIRTHDAY' || err.message === 'INVALID_AGE')
      return error(res, 'Invalid birthday format or date', 400);
    if (err.message === 'BIRTHDAY_IN_FUTURE')
      return error(res, 'Birthday cannot be in the future', 400);
    if (err.message === 'INVALID_HEIGHT')
      return error(res, 'Height must be a valid number in cm (50-300)', 400);
    if (err.message === 'INVALID_WEIGHT')
      return error(res, 'Weight must be a valid number in kg (20-500)', 400);
    if (err.message === 'INVALID_AVATAR')
      return error(res, 'Invalid avatar ID', 400);
    if (err.message === 'AVATAR_NOT_FOUND')
      return error(res, 'Avatar not found', 404);
    if (err.message === 'INVALID_EMAIL')
      return error(res, 'Invalid email format', 400);
    if (err.message === 'EMAIL_EXISTS')
      return error(res, 'An account with this email already exists', 409);
    next(err);
  }
};

// ── PATCH/PUT /api/users/profile ───────────────────────────
router.patch('/profile', verifyToken, handleUpdateProfile);
router.put('/profile', verifyToken, handleUpdateProfile);

// Handler for avatar update
const handleUpdateAvatar = async (req, res, next) => {
  try {
    const avatarId = req.body?.avatarId !== undefined ? req.body.avatarId : req.body?.avatar_id;
    const user = await authService.updateUserAvatar(req.user.id, avatarId);
    return success(res, { user }, 'Avatar updated successfully');
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND')
      return error(res, 'User not found', 404);
    if (err.message === 'AVATAR_REQUIRED')
      return error(res, 'avatarId is required', 400);
    if (err.message === 'INVALID_AVATAR')
      return error(res, 'Invalid avatar ID', 400);
    if (err.message === 'AVATAR_NOT_FOUND')
      return error(res, 'Avatar not found in database', 404);
    next(err);
  }
};

// ── PATCH /api/users/me/avatar & /api/users/avatar ───────
router.patch('/me/avatar', verifyToken, handleUpdateAvatar);
router.patch('/avatar', verifyToken, handleUpdateAvatar);

// Handler for email update
const handleUpdateEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await authService.updateUserEmail(req.user.id, email);
    return success(res, { user }, 'Email updated successfully');
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND')
      return error(res, 'User not found', 404);
    if (err.message === 'EMAIL_REQUIRED')
      return error(res, 'Email is required', 400);
    if (err.message === 'INVALID_EMAIL')
      return error(res, 'Invalid email format', 400);
    if (err.message === 'EMAIL_EXISTS')
      return error(res, 'An account with this email already exists', 409);
    next(err);
  }
};

// ── PATCH /api/users/me/email & /api/users/email ─────────
router.patch('/me/email', verifyToken, handleUpdateEmail);
router.patch('/email', verifyToken, handleUpdateEmail);

// ── GET /api/users/activity ───────────────────────────────
router.get('/activity', verifyToken, async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const data = await taskService.getUserActivity(req.user.id, page, limit);
    return success(res, data, 'Activity fetched successfully');
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND')
      return error(res, 'User not found', 404);
    next(err);
  }
});


// ── GET & PATCH /api/users/me/settings ───────────────────
router.get('/me/settings', verifyToken, async (req, res, next) => {
  try {
    const settings = await userSettingsService.getUserSettings(req.user.id);
    return success(res, { settings }, 'User settings fetched successfully');
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND')
      return error(res, 'User not found', 404);
    next(err);
  }
});

router.patch('/me/settings', verifyToken, async (req, res, next) => {
  try {
    const settings = await userSettingsService.updateUserSettings(req.user.id, req.body);
    return success(res, { settings }, 'User settings updated successfully');
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND')
      return error(res, 'User not found', 404);
    if (err.message === 'INVALID_UNITS')
      return error(res, 'Units must be metric or imperial', 400);
    next(err);
  }
});

export default router;



