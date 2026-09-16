import type { RefreshTokenRepository } from '../repository';
import { memoryStore, type RefreshTokenRecord } from './store';

export class MemoryRefreshTokenRepository implements RefreshTokenRepository {
  async store(params: { jti: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    const record: RefreshTokenRecord = { ...params, revokedAt: null };
    memoryStore.refreshTokens.push(record);
  }

  async findByJti(jti: string): Promise<RefreshTokenRecord | null> {
    return memoryStore.refreshTokens.find((t) => t.jti === jti) ?? null;
  }

  async revoke(jti: string): Promise<void> {
    const record = memoryStore.refreshTokens.find((t) => t.jti === jti);
    if (record) record.revokedAt = new Date();
  }
}
