import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import * as userService from '../services/userService';

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await userService.listUsers());
});

export const getUserStats = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await userService.getUserStats());
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await userService.getUser(req.params.id));
});

export const banUser = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await userService.banUser(req.params.id, req.body.reason));
});

export const unbanUser = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await userService.unbanUser(req.params.id));
});

export const adjustXp = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await userService.adjustXp(req.params.id, req.body.delta, req.body.reason));
});

export const resetStreak = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await userService.resetStreak(req.params.id));
});
