import type { UserRepository } from '../repository';
import type { User, UserStats, UserWithPasswordHash } from '../../types/user';
import { memoryStore } from './store';

function stripPassword(user: User & { passwordHash: string }): User {
  const { passwordHash, ...rest } = user;
  return rest;
}

export class MemoryUserRepository implements UserRepository {
  async findAll(): Promise<User[]> {
    await memoryStore.ensureSeeded();
    return memoryStore.users.map(stripPassword);
  }

  async findById(id: string): Promise<User | null> {
    await memoryStore.ensureSeeded();
    const user = memoryStore.users.find((u) => u.id === id);
    return user ? stripPassword(user) : null;
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPasswordHash | null> {
    await memoryStore.ensureSeeded();
    const user = memoryStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return user ?? null;
  }

  async getStats(): Promise<UserStats> {
    await memoryStore.ensureSeeded();
    const users = memoryStore.users;
    const active = users.filter((u) => u.status === 'active');
    return {
      totalUsers: users.length,
      activeToday: 14,
      avgLevel: Math.round(users.reduce((sum, u) => sum + u.level, 0) / users.length),
      avgStreak: active.length ? Math.round(active.reduce((sum, u) => sum + u.currentStreak, 0) / active.length) : 0,
    };
  }

  async update(id: string, patch: Partial<User>): Promise<User | null> {
    await memoryStore.ensureSeeded();
    const index = memoryStore.users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    memoryStore.users[index] = { ...memoryStore.users[index], ...patch };
    return stripPassword(memoryStore.users[index]);
  }
}
