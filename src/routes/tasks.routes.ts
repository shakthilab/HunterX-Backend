import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { taskInputSchema, reviewDecisionSchema } from '../validation/tasks';
import * as taskController from '../controllers/taskController';

const router = Router();

// Specific paths before the /:id catch-all.
router.get('/stats', taskController.getTaskStats);
router.get('/review-queue', taskController.getReviewQueue);
router.post('/review-queue/:id/decision', validateBody(reviewDecisionSchema), taskController.decideReview);

router.get('/', taskController.listTasks);
router.post('/', validateBody(taskInputSchema), taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.put('/:id', validateBody(taskInputSchema), taskController.updateTask);
router.get('/:id/completions', taskController.getTaskCompletions);
router.get('/:id/assignment-stats', taskController.getTaskAssignmentStats);

export default router;
