import type { Repositories } from '../repository';
import { MemoryUserRepository } from './userRepository';
import { MemoryRefreshTokenRepository } from './refreshTokenRepository';
import { MemoryTaskRepository } from './taskRepository';
import { MemoryReviewRepository } from './reviewRepository';
import { MemoryDashboardRepository } from './dashboardRepository';

export function createMemoryRepositories(): Repositories {
  return {
    users: new MemoryUserRepository(),
    refreshTokens: new MemoryRefreshTokenRepository(),
    tasks: new MemoryTaskRepository(),
    reviews: new MemoryReviewRepository(),
    dashboard: new MemoryDashboardRepository(),
  };
}
