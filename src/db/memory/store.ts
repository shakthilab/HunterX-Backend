// Process-lifetime in-memory data store. Seeded once at startup; all memory/*
// repository implementations read/write these arrays directly.
import type { Task, TaskCompletionLogEntry, PendingReviewItem } from '../../types/task';
import type { Transaction, ReferralActivity, CouponActivityEntry, TopReferrer } from '../../types/dashboard';
import {
  buildSeedUsers,
  buildSeedTasks,
  buildSeedCompletions,
  buildSeedReviews,
  buildSeedTransactions,
  buildSeedTopReferrers,
  buildSeedReferralActivity,
  buildSeedCouponActivity,
  type SeededUser,
} from './seed';

export type RefreshTokenRecord = {
  jti: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

class MemoryStore {
  users: SeededUser[] = [];
  tasks: Task[] = [];
  completions: TaskCompletionLogEntry[] = [];
  reviews: PendingReviewItem[] = [];
  refreshTokens: RefreshTokenRecord[] = [];

  // Static-ish dashboard series that aren't derived from the other collections.
  transactions: Transaction[] = [];
  topReferrers: TopReferrer[] = [];
  referralActivity: ReferralActivity[] = [];
  couponActivity: CouponActivityEntry[] = [];

  private seeded = false;

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    this.users = await buildSeedUsers();
    this.tasks = buildSeedTasks();
    this.completions = buildSeedCompletions(this.tasks);
    this.reviews = buildSeedReviews(this.tasks);
    this.transactions = buildSeedTransactions();
    this.topReferrers = buildSeedTopReferrers();
    this.referralActivity = buildSeedReferralActivity();
    this.couponActivity = buildSeedCouponActivity();
    this.seeded = true;
    // eslint-disable-next-line no-console
    console.log(
      `[memory-db] seeded ${this.users.length} users, ${this.tasks.length} tasks, ${this.completions.length} completions, ${this.reviews.length} pending reviews`
    );
  }
}

export const memoryStore = new MemoryStore();
