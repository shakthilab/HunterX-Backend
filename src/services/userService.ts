import { getRepositories } from '../db';
import { ApiError } from '../utils/response';
import type { User, UserStats } from '../types/user';

export async function listUsers(): Promise<User[]> {
  return getRepositories().users.findAll();
}

export async function getUser(id: string): Promise<User> {
  const user = await getRepositories().users.findById(id);
  if (!user) throw ApiError.notFound(`User ${id} not found`);
  return user;
}

export async function getUserStats(): Promise<UserStats> {
  return getRepositories().users.getStats();
}

export async function banUser(id: string, reason: string): Promise<User> {
  const updated = await getRepositories().users.update(id, { status: 'banned', banReason: reason, currentStreak: 0 });
  if (!updated) throw ApiError.notFound(`User ${id} not found`);
  return updated;
}

export async function unbanUser(id: string): Promise<User> {
  const updated = await getRepositories().users.update(id, { status: 'active', banReason: null });
  if (!updated) throw ApiError.notFound(`User ${id} not found`);
  return updated;
}

export async function adjustXp(id: string, delta: number, reason: string): Promise<User> {
  if (delta === 0) throw ApiError.badRequest('delta must not be 0', 'validation_error');
  if (!reason.trim()) throw ApiError.badRequest('reason must not be empty', 'validation_error');

  const repos = getRepositories();
  const user = await repos.users.findById(id);
  if (!user) throw ApiError.notFound(`User ${id} not found`);

  const nextXp = Math.max(0, user.xp + delta);
  const updated = await repos.users.update(id, { xp: nextXp });
  if (!updated) throw ApiError.notFound(`User ${id} not found`);
  return updated;
}

export async function resetStreak(id: string): Promise<User> {
  const updated = await getRepositories().users.update(id, { currentStreak: 0 });
  if (!updated) throw ApiError.notFound(`User ${id} not found`);
  return updated;
}
