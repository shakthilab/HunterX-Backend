import type { ReviewRepository } from '../repository';
import type { PendingReviewItem } from '../../types/task';
import { getSupabaseClient } from './client';
import { rowToPendingReview } from './mappers';

export class SupabaseReviewRepository implements ReviewRepository {
  async findAll(): Promise<PendingReviewItem[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('pending_reviews').select('*').order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToPendingReview);
  }

  async findById(id: string): Promise<PendingReviewItem | null> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('pending_reviews').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToPendingReview(data) : null;
  }

  async decide(id: string, status: 'approved' | 'rejected'): Promise<PendingReviewItem | null> {
    const db = getSupabaseClient();
    const { data, error } = await db.from('pending_reviews').update({ status }).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return data ? rowToPendingReview(data) : null;
  }
}
