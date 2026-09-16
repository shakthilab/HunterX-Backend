// src/routes/index.js — Mount all API routes

import { Router } from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import avatarsRouter from './avatars.js';
import tasksRouter from './tasks.js';
import adminRouter from './admin.js';
import mediaRouter from './media.js';
import ratingsRouter from './ratings.js';
import feedbackRouter from './feedback.js';

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

// Rate HunterX (single current rating per user)
router.use('/ratings', ratingsRouter);

// Send Feedback screen
router.use('/feedback', feedbackRouter);

export default router;


