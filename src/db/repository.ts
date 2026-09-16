// Repository abstraction. Route/controller/service code depends ONLY on these
// interfaces, never on a concrete driver. Swapping `DB_DRIVER` between
// `memory` and `supabase` swaps the implementation with zero changes above
// this layer.

import type { User, UserStats, UserWithPasswordHash } from '../types/user';
import type {
  Task,
  TaskInput,
  TaskStats,
  TaskCompletionLogEntry,
  TaskAssignmentStats,
  PendingReviewItem,
} from '../types/task';
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
} from '../types/dashboard';

export interface UserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  /** Includes the bcrypt hash; used only by the auth service, never returned to clients. */
  findByEmailWithPassword(email: string): Promise<UserWithPasswordHash | null>;
  getStats(): Promise<UserStats>;
  update(id: string, patch: Partial<User>): Promise<User | null>;
}

export interface RefreshTokenRepository {
  store(params: { jti: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Looks up a stored refresh token record by its jti (unrevoked or not). */
  findByJti(jti: string): Promise<{ jti: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null } | null>;
  revoke(jti: string): Promise<void>;
}

export interface TaskRepository {
  findAll(): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  create(input: TaskInput): Promise<Task>;
  update(id: string, input: TaskInput): Promise<Task | null>;
  getStats(): Promise<TaskStats>;
  getCompletions(taskId: string): Promise<TaskCompletionLogEntry[]>;
  getAssignmentStats(taskId: string): Promise<TaskAssignmentStats>;
}

export interface ReviewRepository {
  findAll(): Promise<PendingReviewItem[]>;
  findById(id: string): Promise<PendingReviewItem | null>;
  decide(id: string, status: 'approved' | 'rejected'): Promise<PendingReviewItem | null>;
}

export interface DashboardRepository {
  getCoreKpis(): Promise<CoreKpis>;
  getSubscriptionOverview(): Promise<SubscriptionOverview>;
  getMrrTrend(days: number): Promise<TrendPoint[]>;
  getDauTrend(days: number): Promise<TrendPoint[]>;
  getStreakDropoff(): Promise<StreakDropoffPoint[]>;
  getRecentTransactions(limit: number): Promise<Transaction[]>;
  getReferralOverview(): Promise<ReferralOverview>;
  getTopReferrers(): Promise<TopReferrer[]>;
  getRecentReferralActivity(): Promise<ReferralActivity[]>;
  getCouponOverview(): Promise<CouponOverview>;
  getCouponActivityLog(): Promise<CouponActivityEntry[]>;
}

export interface Repositories {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  tasks: TaskRepository;
  reviews: ReviewRepository;
  dashboard: DashboardRepository;
}
