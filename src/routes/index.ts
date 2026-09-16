import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import authRoutes from './auth.routes';
import userRoutes from './users.routes';
import taskRoutes from './tasks.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

// Public
router.use('/auth', authRoutes);

// Every /admin/* route requires a valid access token belonging to an admin.
router.use('/admin', requireAuth, requireAdmin);
router.use('/admin/users', userRoutes);
router.use('/admin/tasks', taskRoutes);
router.use('/admin/dashboard', dashboardRoutes);

export default router;
