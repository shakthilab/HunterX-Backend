// src/routes/index.js — Mount all API routes

import { Router } from 'express';
import authRouter from './auth.js';

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

// Coming soon — uncomment as each is built
// router.use('/tasks',         tasksRouter);
// router.use('/users',         usersRouter);
// router.use('/xp',            xpRouter);
// router.use('/rewards',       rewardsRouter);
// router.use('/leaderboard',   leaderboardRouter);
// router.use('/notifications', notificationsRouter);
// router.use('/admin',         adminRouter);

export default router;
