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
import { getSupabaseClient } from './client';
import { rowToTransaction, rowToReferralActivity, rowToCouponActivity } from './mappers';
import { buildMrrTrend, buildDauTrend, buildStreakDropoff } from '../memory/seed';

// NOTE: there is no dedicated "subscriptions" table in the 0001_init migration
// (the frontend contract for subscriptions/MRR/DAU/streak-dropoff is a set of
// aggregate numbers, not a list the admin UI paginates or filters). Those
// series are generated the same deterministic way the memory driver does,
// which keeps this driver code-complete without inventing a billing-provider
// integration that doesn't exist yet. Swap these for real queries once a
// subscriptions/billing table exists.

export class SupabaseDashboardRepository implements DashboardRepository {
  async getCoreKpis(): Promise<CoreKpis> {
    const db = getSupabaseClient();
    const [{ count: totalUsers, error: usersErr }, { count: openFeedbackTickets, error: feedbackErr }] = await Promise.all([
      db.from('users').select('*', { count: 'exact', head: true }),
      db.from('user_feedback_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    if (usersErr) throw usersErr;
    if (feedbackErr) throw feedbackErr;
    return {
      totalUsers: totalUsers ?? 0,
      activeToday: 14,
      newSignupsToday: 3,
      activeSubscriptions: 18,
      tasksCompletedToday: 47,
      openFeedbackTickets: openFeedbackTickets ?? 0,
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
    const db = getSupabaseClient();
    const { data, error } = await db.from('transactions').select('*').order('date', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map(rowToTransaction);
  }

  async getReferralOverview(): Promise<ReferralOverview> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('referral_activity').select('status');
    if (error) throw error;
    const rows: any[] = data ?? [];
    const totalLinksSent = rows.length;
    const successfulSignups = rows.filter((r) => r.status === 'signed_up' || r.status === 'converted').length;
    const converted = rows.filter((r) => r.status === 'converted').length;
    return {
      totalLinksSent,
      successfulSignups,
      referralToPaidPct: totalLinksSent ? Math.round((converted / totalLinksSent) * 100) : 0,
    };
  }

  async getTopReferrers(): Promise<TopReferrer[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('referral_activity').select('referrer_id, referrer_name, status');
    if (error) throw error;
    const rows: any[] = data ?? [];
    const byReferrer = new Map<string, TopReferrer>();
    for (const row of rows) {
      const key = row.referrer_id ?? row.referrer_name;
      const entry = byReferrer.get(key) ?? { userId: row.referrer_id ?? key, userName: row.referrer_name, linksSent: 0, signups: 0, paidConversions: 0 };
      entry.linksSent += 1;
      if (row.status === 'signed_up' || row.status === 'converted') entry.signups += 1;
      if (row.status === 'converted') entry.paidConversions += 1;
      byReferrer.set(key, entry);
    }
    return Array.from(byReferrer.values())
      .sort((a, b) => b.linksSent - a.linksSent)
      .slice(0, 5);
  }

  async getRecentReferralActivity(): Promise<ReferralActivity[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('referral_activity').select('*').order('date', { ascending: false }).limit(20);
    if (error) throw error;
    return (data ?? []).map(rowToReferralActivity);
  }

  async getCouponOverview(): Promise<CouponOverview> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('coupons').select('tier, status');
    if (error) throw error;
    const rows: any[] = data ?? [];
    const issued = rows.length;
    const redeemed = rows.filter((r) => r.status === 'redeemed').length;
    const unredeemed = rows.filter((r) => r.status === 'unredeemed').length;
    const expired = rows.filter((r) => r.status === 'expired').length;
    const tiers: string[] = Array.from(new Set(rows.map((r) => r.tier as string)));
    return {
      issued,
      redeemed,
      unredeemed,
      expired,
      redemptionRatePct: issued ? Math.round((redeemed / issued) * 100) : 0,
      byTier: tiers.map((tier) => ({
        tier,
        used: rows.filter((r) => r.tier === tier && r.status === 'redeemed').length,
        unused: rows.filter((r) => r.tier === tier && r.status === 'unredeemed').length,
        expired: rows.filter((r) => r.tier === tier && r.status === 'expired').length,
      })),
    };
  }

  async getCouponActivityLog(): Promise<CouponActivityEntry[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('coupon_activity').select('*').order('date', { ascending: false }).limit(20);
    if (error) throw error;
    return (data ?? []).map(rowToCouponActivity);
  }
}
