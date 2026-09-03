// src/routes/index.js — Mount all API routes

import { Router } from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import avatarsRouter from './avatars.js';
import tasksRouter from './tasks.js';
import adminRouter from './admin.js';
import mediaRouter from './media.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success:   true,
    message:   'HunterX API is running',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV,
  });
});

// Auth and onboarding
router.use('/auth', authRouter);

// User profiles
router.use('/users', usersRouter);

// Avatars catalog
router.use('/avatars', avatarsRouter);

// Daily & weekly tasks
router.use('/tasks', tasksRouter);

// Admin
router.use('/admin', adminRouter);

// Signed Cloudinary uploads
router.use('/media', mediaRouter);

export default router;


