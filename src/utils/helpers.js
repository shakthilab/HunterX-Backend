// src/utils/helpers.js — Shared utility functions

import prisma from '../config/prisma.js';
import jwt    from 'jsonwebtoken';
import crypto from 'crypto';

BigInt.prototype.toJSON = function () {
  return this.toString();
};

// Generate unique Hunter ID e.g. HUN00001
export async function generateHunterId() {
  const count  = await prisma.users.count();
  const number = String(count + 1).padStart(5, '0');
  const prefix = process.env.HUNTER_ID_PREFIX || 'HUN';
  return `${prefix}${number}`;
}

// Generate random 8 character referral code e.g. AX7KPQ2M
export function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// Generate secure random reset token
export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Calculate BMI — weight in kg, height in cm
export function calculateBMI(weightKg, heightCm) {
  const heightM = heightCm / 100;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(2));
}

// Calculate daily protein goal in grams
// activityKey must match one of the keys below
export function calculateProtein(weightKg, activityKey) {
  const multipliers = {
    sedentary:      0.8,
    lightly_active: 1.2,
    active:         1.6,
    very_active:    2.0,
  };
  const multiplier = multipliers[activityKey] ?? 0.8;
  return parseFloat((weightKg * multiplier).toFixed(1));
}

// Today's date in IST (UTC+5:30), as a UTC-midnight Date — safe to store
// in @db.Date columns (schedule_date) without timezone drift.
// offsetDays lets callers shift forward/back (e.g. -1 for yesterday).
export function getISTDateOnly(offsetDays = 0) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  nowIST.setUTCDate(nowIST.getUTCDate() + offsetDays);
  return new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()));
}

// Monday of the current IST week, as a UTC-midnight Date — used as the
// schedule_date "period key" for WEEKLY tasks so a weekly quest has one
// completion row per week instead of one per day.
export function getISTWeekStart() {
  const todayIST = getISTDateOnly();
  const day = todayIST.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(todayIST);
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday;
}

// Validate email format
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate password — minimum 8 characters
export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

// Validate strong password — matches Screen 3 rules
// At least 8 characters
// At least one uppercase letter
// At least one number
// At least one special character
export function isStrongPassword(password) {
  if (typeof password !== 'string') return { valid: false, errors: ['Password is required'] };

  const errors = [];

  if (password.length < 8)
    errors.push('AT_LEAST_8_CHARACTERS');
  if (!/[A-Z]/.test(password))
    errors.push('ONE_UPPERCASE_LETTER');
  if (!/[0-9]/.test(password))
    errors.push('ONE_NUMBER');
  if (!/[^A-Za-z0-9]/.test(password))
    errors.push('ONE_SPECIAL_CHARACTER');

  return {
    valid:  errors.length === 0,
    errors,
  };
}

// Generate access + refresh token pair
export function generateTokens(userId, role) {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d' }
  );
  return { accessToken, refreshToken };
}

// Verify access token — returns decoded payload or throws
export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Verify refresh token — returns decoded payload or throws
export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}
