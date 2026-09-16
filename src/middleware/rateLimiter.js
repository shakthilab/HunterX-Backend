// src/middleware/rateLimiter.js — Rate limiting

import rateLimit from 'express-rate-limit';

// General — 1000 requests per 15 minutes in production, 5000 in development
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 5000 : 1000,
  message: {
    success: false,
    message: 'Too many requests. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders:   false,
});

// Auth — stricter — 150 requests per 15 minutes in production, 1000 in development
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 150,
  message: {
    success: false,
    message: 'Too many auth attempts. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders:   false,
});
