import type { ReviewRepository } from '../repository';
import type { PendingReviewItem } from '../../types/task';
import { memoryStore } from './store';

export class MemoryReviewRepository implements ReviewRepository {
  async findAll(): Promise<PendingReviewItem[]> {
    await memoryStore.ensureSeeded();
    return memoryStore.reviews;
  }

  async findById(id: string): Promise<PendingReviewItem | null> {
    await memoryStore.ensureSeeded();
    return memoryStore.reviews.find((r) => r.id === id) ?? null;
  }

  async decide(id: string, status: 'approved' | 'rejected'): Promise<PendingReviewItem | null> {
    await memoryStore.ensureSeeded();
    const index = memoryStore.reviews.findIndex((r) => r.id === id);
    if (index === -1) return null;
    memoryStore.reviews[index] = { ...memoryStore.reviews[index], status };
    return memoryStore.reviews[index];
  }
}
