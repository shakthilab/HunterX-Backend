import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { loginSchema, refreshSchema, logoutSchema } from '../validation/auth';
import * as authController from '../controllers/authController';

const router = Router();

router.post('/login', validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/logout', validateBody(logoutSchema), authController.logout);

export default router;
