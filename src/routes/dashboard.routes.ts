import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();

router.get('/kpis', dashboardController.getKpis);
router.get('/subscriptions', dashboardController.getSubscriptions);
router.get('/mrr-trend', dashboardController.getMrrTrend);
router.get('/dau-trend', dashboardController.getDauTrend);
router.get('/streak-dropoff', dashboardController.getStreakDropoff);
router.get('/rank-distribution', dashboardController.getRankDistribution);
router.get('/transactions', dashboardController.getTransactions);
router.get('/referrals', dashboardController.getReferrals);
router.get('/top-referrers', dashboardController.getTopReferrers);
router.get('/referral-activity', dashboardController.getReferralActivity);
router.get('/coupons', dashboardController.getCoupons);
router.get('/coupon-activity', dashboardController.getCouponActivity);
router.get('/needs-attention', dashboardController.getNeedsAttention);

export default router;
