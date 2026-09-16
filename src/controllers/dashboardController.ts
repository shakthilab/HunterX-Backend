import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import * as dashboardService from '../services/dashboardService';

function intParam(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const getKpis = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getCoreKpis());
});

export const getSubscriptions = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getSubscriptionOverview());
});

export const getMrrTrend = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await dashboardService.getMrrTrend(intParam(req.query.days, 90)));
});

export const getDauTrend = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await dashboardService.getDauTrend(intParam(req.query.days, 30)));
});

export const getStreakDropoff = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getStreakDropoff());
});

export const getRankDistribution = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getRankDistribution());
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await dashboardService.getRecentTransactions(intParam(req.query.limit, 10)));
});

export const getReferrals = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getReferralOverview());
});

export const getTopReferrers = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getTopReferrers());
});

export const getReferralActivity = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getRecentReferralActivity());
});

export const getCoupons = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getCouponOverview());
});

export const getCouponActivity = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getCouponActivityLog());
});

export const getNeedsAttention = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await dashboardService.getNeedsAttention());
});
