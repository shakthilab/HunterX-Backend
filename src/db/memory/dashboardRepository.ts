import type { DashboardRepository } from '../repository';
import type {
  CoreKpis,
  SubscriptionOverview,
  Transaction,
  ReferralOverview,
  TopReferrer,
  ReferralActivity,
  CouponOverview,
  CouponActivityEntry,
  TrendPoint,
  StreakDropoffPoint,
} from '../../types/dashboard';
import { memoryStore } from './store';
import { buildMrrTrend, buildDauTrend, buildStreakDropoff } from './seed';

export class MemoryDashboardRepository implements DashboardRepository {
  async getCoreKpis(): Promise<CoreKpis> {
    await memoryStore.ensureSeeded();
    const openFeedbackTickets = memoryStore.users.reduce(
      (sum, u) => sum + u.feedbackTickets.filter((t) => t.status === 'open').length,
      0
    );
    return {
      totalUsers: memoryStore.users.length,
      activeToday: 14,
      newSignupsToday: 3,
      activeSubscriptions: 18,
      tasksCompletedToday: 47,
      openFeedbackTickets,
      totalUsersDelta: 4.2,
      activeTodayDelta: -2.1,
      newSignupsTodayDelta: 12.5,
      activeSubscriptionsDelta: 1.8,
      tasksCompletedTodayDelta: 6.4,
      openFeedbackTicketsDelta: -8.3,
    };
  }

  async getSubscriptionOverview(): Promise<SubscriptionOverview> {
    return {
      mrr: 8420,
      activeSubscribers: 18,
      newSubsToday: 2,
      newSubsWeek: 9,
      churnedThisWeek: 3,
      trialToPaidPct: 62,
      statusBreakdown: [
        { status: 'Active', count: 18 },
        { status: 'Trialing', count: 5 },
        { status: 'Past Due', count: 2 },
        { status: 'Canceled', count: 4 },
      ],
    };
  }

  async getMrrTrend(days: number): Promise<TrendPoint[]> {
    return buildMrrTrend(days);
  }

  async getDauTrend(days: number): Promise<TrendPoint[]> {
    return buildDauTrend(days);
  }

  async getStreakDropoff(): Promise<StreakDropoffPoint[]> {
    return buildStreakDropoff();
  }

  async getRecentTransactions(limit: number): Promise<Transaction[]> {
    await memoryStore.ensureSeeded();
    return memoryStore.transactions.slice(0, limit);
  }

  async getReferralOverview(): Promise<ReferralOverview> {
    return { totalLinksSent: 342, successfulSignups: 96, referralToPaidPct: 34 };
  }

  async getTopReferrers(): Promise<TopReferrer[]> {
    await memoryStore.ensureSeeded();
    return memoryStore.topReferrers;
  }

  async getRecentReferralActivity(): Promise<ReferralActivity[]> {
    await memoryStore.ensureSeeded();
    return memoryStore.referralActivity;
  }

  async getCouponOverview(): Promise<CouponOverview> {
    return {
      issued: 210,
      redeemed: 134,
      unredeemed: 58,
      expired: 18,
      redemptionRatePct: 64,
      byTier: [
        { tier: 'Bronze', used: 40, unused: 15, expired: 5 },
        { tier: 'Silver', used: 38, unused: 18, expired: 6 },
        { tier: 'Gold', used: 32, unused: 14, expired: 4 },
        { tier: 'Platinum', used: 24, unused: 11, expired: 3 },
      ],
    };
  }

  async getCouponActivityLog(): Promise<CouponActivityEntry[]> {
    await memoryStore.ensureSeeded();
    return memoryStore.couponActivity;
  }
}
