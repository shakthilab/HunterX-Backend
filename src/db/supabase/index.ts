import type { Repositories } from '../repository';
import { SupabaseUserRepository } from './userRepository';
import { SupabaseRefreshTokenRepository } from './refreshTokenRepository';
import { SupabaseTaskRepository } from './taskRepository';
import { SupabaseReviewRepository } from './reviewRepository';
import { SupabaseDashboardRepository } from './dashboardRepository';

export function createSupabaseRepositories(): Repositories {
  return {
    users: new SupabaseUserRepository(),
    refreshTokens: new SupabaseRefreshTokenRepository(),
    tasks: new SupabaseTaskRepository(),
    reviews: new SupabaseReviewRepository(),
    dashboard: new SupabaseDashboardRepository(),
  };
}
