import { getRepositories } from '../db';
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
  RankDistributionPoint,
  NeedsAttentionItem,
  StreakDropoffPoint,
} from '../types/dashboard';
import type { UserRank } from '../types/user';

const RANK_ORDER: UserRank[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic'];

export async function getCoreKpis(): Promise<CoreKpis> {
  return getRepositories().dashboard.getCoreKpis();
}

export async function getSubscriptionOverview(): Promise<SubscriptionOverview> {
  return getRepositories().dashboard.getSubscriptionOverview();
}

export async function getMrrTrend(days: number): Promise<TrendPoint[]> {
  return getRepositories().dashboard.getMrrTrend(days);
}

export async function getDauTrend(days: number): Promise<TrendPoint[]> {
  return getRepositories().dashboard.getDauTrend(days);
}

export async function getStreakDropoff(): Promise<StreakDropoffPoint[]> {
  return getRepositories().dashboard.getStreakDropoff();
}

export async function getRankDistribution(): Promise<RankDistributionPoint[]> {
  const users = await getRepositories().users.findAll();
  return RANK_ORDER.map((rank) => ({
    rank: rank.charAt(0).toUpperCase() + rank.slice(1),
    users: users.filter((u) => u.rank === rank).length,
  }));
}

export async function getRecentTransactions(limit: number): Promise<Transaction[]> {
  return getRepositories().dashboard.getRecentTransactions(limit);
}

export async function getReferralOverview(): Promise<ReferralOverview> {
  return getRepositories().dashboard.getReferralOverview();
}

export async function getTopReferrers(): Promise<TopReferrer[]> {
  return getRepositories().dashboard.getTopReferrers();
}

export async function getRecentReferralActivity(): Promise<ReferralActivity[]> {
  return getRepositories().dashboard.getRecentReferralActivity();
}

export async function getCouponOverview(): Promise<CouponOverview> {
  return getRepositories().dashboard.getCouponOverview();
}

export async function getCouponActivityLog(): Promise<CouponActivityEntry[]> {
  return getRepositories().dashboard.getCouponActivityLog();
}

export async function getNeedsAttention(): Promise<NeedsAttentionItem[]> {
  const repos = getRepositories();
  const [reviews, users, transactions] = await Promise.all([
    repos.reviews.findAll(),
    repos.users.findAll(),
    repos.dashboard.getRecentTransactions(10),
  ]);

  const items: NeedsAttentionItem[] = [
    ...reviews
      .filter((r) => r.status === 'pending')
      .slice(0, 2)
      .map((r) => ({
        id: `att_review_${r.id}`,
        type: 'gps_review' as const,
        title: `Flagged submission — ${r.taskTitle}`,
        description: `${r.userName}: ${r.flagReason}`,
        timestamp: r.submittedAt,
        href: '/tasks/review',
      })),
    ...users
      .flatMap((u) => u.feedbackTickets.filter((t) => t.status === 'open').map((t) => ({ user: u, ticket: t })))
      .slice(0, 2)
      .map(({ user, ticket }) => ({
        id: `att_fbk_${ticket.id}`,
        type: 'feedback_ticket' as const,
        title: ticket.subject,
        description: `Open ticket from ${user.displayName}`,
        timestamp: ticket.createdAt,
        href: `/users/${user.id}`,
      })),
    ...transactions
      .filter((t) => t.status === 'failed')
      .slice(0, 2)
      .map((t) => ({
        id: `att_txn_${t.id}`,
        type: 'failed_payment' as const,
        title: `Payment failed — ${t.userName}`,
        description: `${t.plan} · $${t.amount} via ${t.method}`,
        timestamp: t.date,
        href: '/subscriptions',
      })),
    ...users
      .filter((u) => u.status === 'banned')
      .slice(0, 2)
      .map((u) => ({
        id: `att_ban_${u.id}`,
        type: 'banned_user' as const,
        title: `Account banned — ${u.displayName}`,
        description: u.banReason ?? 'No reason on file',
        timestamp: u.createdAt,
        href: `/users/${u.id}`,
      })),
  ];

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
