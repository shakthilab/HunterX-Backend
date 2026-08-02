// src/routes/auth.js — All auth and onboarding endpoints

import { Router }         from 'express';
import { authLimiter }    from '../middleware/rateLimiter.js';
import { verifyToken }    from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import {
  isValidEmail,
  isValidPassword,
  isStrongPassword,
} from '../utils/helpers.js';
import * as authService   from '../services/authService.js';

const router = Router();

// ── POST /api/auth/send-otp ───────────────────────────────
// OTP for email + password registration only
// Google and Apple users skip this entirely

router.post('/send-otp', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email)
      return error(res, 'Email is required', 400);

    if (!isValidEmail(email))
      return error(res, 'Invalid email format', 400);

    await authService.sendOtp(email);

    return success(res, null,
      'Verification code sent to your email. It expires in 10 minutes.');

  } catch (err) {
    if (err.message === 'EMAIL_EXISTS')
      return error(res, 'An account with this email already exists', 409);
    next(err);
  }
});

// ── POST /api/auth/verify-otp ──────────────────────────────

router.post('/verify-otp', authLimiter, async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email)
      return error(res, 'Email is required', 400);

    if (!isValidEmail(email))
      return error(res, 'Invalid email format', 400);

    if (!otp)
      return error(res, 'Verification code is required', 400);

    if (!/^\d{6}$/.test(otp.trim()))
      return error(res, 'Verification code must be exactly 6 digits', 400);

    await authService.verifyOtp(email, otp);

    return success(res, null, 'Email verified. You may now create your account.');

  } catch (err) {
    if (err.message === 'INVALID_OTP')
      return error(res,
        'Invalid or expired verification code. Please request a new one.', 400);
    next(err);
  }
});

// ── POST /api/auth/register ───────────────────────────────
// Creates account with email + password
// Saves all onboarding answers in same call
// Body: { name, email, password, onboarding[] }

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password, onboarding = [] } = req.body;

    // Validate required fields
    if (!name?.trim())
      return error(res, 'Hunter name is required', 400);
    if (!email)
      return error(res, 'Hunters ID (email) is required', 400);
    if (!isValidEmail(email))
      return error(res, 'Invalid email format', 400);
    if (!password)
      return error(res, 'Secret Key (password) is required', 400);
    if (!isValidPassword(password))
      return error(res, 'Secret Key must be at least 8 characters', 400);

    // Validate onboarding array if provided
    if (onboarding.length > 0) {
      for (const a of onboarding) {
        if (!a.questionId || a.answer === undefined || a.answer === null) {
          return error(res, 'Each onboarding answer needs questionId and answer', 400);
        }
        if (a.questionId < 1 || a.questionId > 10) {
          return error(res, `Invalid questionId ${a.questionId} — must be 1 to 10`, 400);
        }
      }
    }

    const result = await authService.registerWithEmail(
      name, email, password, onboarding
    );

    return success(res, {
      user:          result.user,
      access_token:  result.accessToken,
      refresh_token: result.refreshToken,
      isNew:         true,
    }, 'Account created. Welcome, Hunter.', 201);

  } catch (err) {
    if (err.message === 'EMAIL_NOT_VERIFIED')
      return error(res,
        'Please verify your email first. Use send-otp then verify-otp.', 403);
    if (err.message === 'EMAIL_EXISTS')
      return error(res, 'An account with this email already exists', 409);
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────
// Login with email + password
// No onboarding — existing users go straight to home
// Body: { email, password }

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return error(res, 'Email and password are required', 400);
    if (!isValidEmail(email))
      return error(res, 'Invalid email format', 400);

    const result = await authService.loginWithEmail(email, password);

    return success(res, {
      user:          result.user,
      access_token:  result.accessToken,
      refresh_token: result.refreshToken,
      isNew:         result.isNew,
    }, 'Login successful');

  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS')
      return error(res, 'Invalid email or password', 401);
    if (err.message === 'ACCOUNT_BANNED')
      return error(res, 'Your account has been suspended', 403);
    next(err);
  }
});

// ── POST /api/auth/google ─────────────────────────────────
// New users — creates account + saves onboarding in one call
// Existing users — logs in, ignores onboarding array
// Body: { idToken, onboarding[] }

router.post('/google', authLimiter, async (req, res, next) => {
  try {
    const { idToken, onboarding = [] } = req.body;

    if (!idToken)
      return error(res, 'Google ID token is required', 400);

    if (onboarding.length > 0) {
      for (const a of onboarding) {
        if (!a.questionId || a.answer === undefined || a.answer === null)
          return error(res, 'Each onboarding answer needs questionId and answer', 400);
        if (a.questionId < 1 || a.questionId > 10)
          return error(res, `Invalid questionId ${a.questionId}`, 400);
      }
    }

    const result = await authService.loginWithGoogle(idToken, onboarding);

    return success(res, {
      user:          result.user,
      access_token:  result.accessToken,
      refresh_token: result.refreshToken,
      isNew:         result.isNew,
      linked:        result.linked || false,
    }, result.isNew ? 'Account created. Welcome, Hunter.' : 'Login successful');

  } catch (err) {
    if (err.message === 'ACCOUNT_BANNED')
      return error(res, 'Your account has been suspended', 403);
    next(err);
  }
});

// ── POST /api/auth/apple ──────────────────────────────────
// New users — creates account + saves onboarding in one call
// Existing users — logs in, ignores onboarding array
// Body: { idToken, nonce?, onboarding[] }

router.post('/apple', authLimiter, async (req, res, next) => {
  try {
    const { idToken, nonce, onboarding = [] } = req.body;

    if (!idToken)
      return error(res, 'Apple ID token is required', 400);

    if (onboarding.length > 0) {
      for (const a of onboarding) {
        if (!a.questionId || a.answer === undefined || a.answer === null)
          return error(res, 'Each onboarding answer needs questionId and answer', 400);
        if (a.questionId < 1 || a.questionId > 10)
          return error(res, `Invalid questionId ${a.questionId}`, 400);
      }
    }

    const result = await authService.loginWithApple(idToken, nonce, onboarding);

    return success(res, {
      user:          result.user,
      access_token:  result.accessToken,
      refresh_token: result.refreshToken,
      isNew:         result.isNew,
      linked:        result.linked || false,
    }, result.isNew ? 'Account created. Welcome, Hunter.' : 'Login successful');

  } catch (err) {
    if (err.message === 'ACCOUNT_BANNED')
      return error(res, 'Your account has been suspended', 403);
    next(err);
  }
});

// ── POST /api/auth/refresh ────────────────────────────────
// Get new access token using refresh token
// Body: { refreshToken }

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken)
      return error(res, 'Refresh token is required', 400);

    const result = await authService.refreshAccessToken(refreshToken);

    return success(res, {
      access_token:  result.accessToken,
      refresh_token: result.refreshToken,
    }, 'Token refreshed');

  } catch (err) {
    if (err.message === 'USER_NOT_FOUND')
      return error(res, 'User not found', 404);
    if (err.name === 'TokenExpiredError')
      return error(res, 'Refresh token expired — please login again', 401);
    next(err);
  }
});

// ── POST /api/auth/forgot-password ───────────────────────
// Send reset email — checks if email exists first
// Body: { email }

router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email)
      return error(res, 'Email is required', 400);
    if (!isValidEmail(email))
      return error(res, 'Invalid email format', 400);

    await authService.forgotPassword(email);

    return success(res, null,
      'Recovery link sent. Check your spam folder if you do not receive it within 2 minutes.');

  } catch (err) {
    if (err.message === 'EMAIL_NOT_FOUND')
      return error(res, 'No account found with this email address', 404);
    if (err.message === 'SOCIAL_ACCOUNT')
      return error(res, 'This account uses Google or Apple sign-in. Password reset is not available.', 400);
    if (err.message === 'RESET_COOLDOWN')
      return error(res, `A reset email was already sent. Please wait ${err.remainingMinutes} minutes before requesting another reset email.`, 429);
    next(err);
  }
});

// ── POST /api/auth/reset-password ────────────────────────
// Reset password using token from email link
// Body: { token, newPassword, confirmPassword }
// Accepts token from body or query params

router.post('/reset-password', async (req, res, next) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const token = req.body?.token || req.query?.token;

    // Validate token
    if (!token)
      return error(res, 'Reset token is required', 400);

    // Validate new password exists
    if (!newPassword)
      return error(res, 'New password is required', 400);

    // Validate password strength — matches all 4 rules on Screen 3
    const { valid, errors } = isStrongPassword(newPassword);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors,
      });
    }

    // Validate confirm password matches
    if (confirmPassword !== undefined && confirmPassword !== newPassword)
      return error(res, 'Passwords do not match', 400);

    await authService.resetPassword(token, newPassword);

    return success(res, null, 'Password updated successfully. You can now log in.');

  } catch (err) {
    if (err.message === 'INVALID_OR_EXPIRED_TOKEN')
      return error(res, 'Reset link is invalid or has expired. Please request a new one.', 400);
    next(err);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────
// Get current authenticated user
// Header: Authorization: Bearer <access_token>

router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    if (!user) return error(res, 'User not found', 404);
    return success(res, { user }, 'User fetched');
  } catch (err) {
    next(err);
  }
});

export default router;
