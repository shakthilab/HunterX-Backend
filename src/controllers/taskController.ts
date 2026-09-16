import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import * as taskService from '../services/taskService';

export const listTasks = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await taskService.listTasks());
});

export const getTaskStats = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await taskService.getTaskStats());
});

export const getReviewQueue = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await taskService.listReviewQueue());
});

export const decideReview = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await taskService.decideReview(req.params.id, req.body.status));
});

export const getTaskById = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await taskService.getTask(req.params.id));
});

export const getTaskCompletions = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await taskService.getTaskCompletions(req.params.id));
});

export const getTaskAssignmentStats = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await taskService.getTaskAssignmentStats(req.params.id));
});

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await taskService.createTask(req.body), 201);
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await taskService.updateTask(req.params.id, req.body));
});
