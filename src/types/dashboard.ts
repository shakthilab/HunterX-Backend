export type TrendPoint = { date: string; value: number };

export type CoreKpis = {
  totalUsers: number;
  activeToday: number;
  newSignupsToday: number;
  activeSubscriptions: number;
  tasksCompletedToday: number;
  openFeedbackTickets: number;
  totalUsersDelta: number;
  activeTodayDelta: number;
  newSignupsTodayDelta: number;
  activeSubscriptionsDelta: number;
  tasksCompletedTodayDelta: number;
  openFeedbackTicketsDelta: number;
};

export type SubscriptionOverview = {
  mrr: number;
  activeSubscribers: number;
  newSubsToday: number;
  newSubsWeek: number;
  churnedThisWeek: number;
  trialToPaidPct: number;
  statusBreakdown: { status: string; count: number }[];
};

export type PaymentStatus = 'paid' | 'failed' | 'pending' | 'refunded';

export type Transaction = {
  id: string;
  userName: string;
  plan: string;
  amount: number;
  status: PaymentStatus;
  date: string;
  method: string;
};

export type ReferralOverview = {
  totalLinksSent: number;
  successfulSignups: number;
  referralToPaidPct: number;
};

export type TopReferrer = {
  userId: string;
  userName: string;
  linksSent: number;
  signups: number;
  paidConversions: number;
};

export type ReferralActivity = {
  id: string;
  referrerName: string;
  refereeName: string;
  status: 'signed_up' | 'converted' | 'pending';
  date: string;
};

export type CouponOverview = {
  issued: number;
  redeemed: number;
  unredeemed: number;
  expired: number;
  redemptionRatePct: number;
  byTier: { tier: string; used: number; unused: number; expired: number }[];
};

export type CouponActivityEntry = {
  id: string;
  code: string;
  partner: string;
  userName: string;
  action: 'issued' | 'redeemed' | 'expired';
  date: string;
};

export type RankDistributionPoint = { rank: string; users: number };

export type NeedsAttentionItem = {
  id: string;
  type: 'gps_review' | 'feedback_ticket' | 'failed_payment' | 'banned_user';
  title: string;
  description: string;
  timestamp: string;
  href: string;
};

export type StreakDropoffPoint = { day: number; usersRemaining: number };
