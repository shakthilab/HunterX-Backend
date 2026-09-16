import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { banUserSchema, xpAdjustmentSchema } from '../validation/users';
import * as userController from '../controllers/userController';

const router = Router();

// Specific paths before the /:id catch-all.
router.get('/stats', userController.getUserStats);
router.get('/', userController.listUsers);
router.get('/:id', userController.getUserById);
router.patch('/:id/ban', validateBody(banUserSchema), userController.banUser);
router.patch('/:id/unban', userController.unbanUser);
router.post('/:id/xp-adjustment', validateBody(xpAdjustmentSchema), userController.adjustXp);
router.post('/:id/reset-streak', userController.resetStreak);

export default router;
