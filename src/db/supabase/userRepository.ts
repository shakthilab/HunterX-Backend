import type { UserRepository } from '../repository';
import type { User, UserStats, UserWithPasswordHash } from '../../types/user';
import { getSupabaseClient } from './client';
import {
  rowToUser,
  rowToUserWithPassword,
  userPatchToRow,
  rowToActivityLogEntry,
  rowToBadge,
  rowToRewardClaim,
  rowToFeedbackTicket,
} from './mappers';

async function loadRelated(userId: string) {
  const db = getSupabaseClient();
  const [activity, badges, rewards, feedback] = await Promise.all([
    db.from('user_activity_log').select('*').eq('user_id', userId).order('completed_at', { ascending: false }),
    db.from('user_badges').select('*').eq('user_id', userId).order('earned_at', { ascending: false }),
    db.from('user_reward_claims').select('*').eq('user_id', userId).order('claimed_at', { ascending: false }),
    db.from('user_feedback_tickets').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  return {
    activityLog: (activity.data ?? []).map(rowToActivityLogEntry),
    badges: (badges.data ?? []).map(rowToBadge),
    rewardClaims: (rewards.data ?? []).map(rowToRewardClaim),
    feedbackTickets: (feedback.data ?? []).map(rowToFeedbackTicket),
  };
}

export class SupabaseUserRepository implements UserRepository {
  async findAll(): Promise<User[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('users').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    const rows: any[] = data ?? [];
    return Promise.all(rows.map(async (row) => rowToUser(row, await loadRelated(row.id))));
  }

  async findById(id: string): Promise<User | null> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToUser(data, await loadRelated(id));
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPasswordHash | null> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('users').select('*').ilike('email', email).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToUserWithPassword(data, await loadRelated(data.id));
  }

  async getStats(): Promise<UserStats> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('users').select('level, current_streak, status');
    if (error) throw error;
    const rows: any[] = data ?? [];
    const active = rows.filter((r) => r.status === 'active');
    return {
      totalUsers: rows.length,
      activeToday: 14,
      avgLevel: rows.length ? Math.round(rows.reduce((sum, r) => sum + r.level, 0) / rows.length) : 0,
      avgStreak: active.length ? Math.round(active.reduce((sum, r) => sum + r.current_streak, 0) / active.length) : 0,
    };
  }

  async update(id: string, patch: Partial<User>): Promise<User | null> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('users').update(userPatchToRow(patch)).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToUser(data, await loadRelated(id));
  }
}
