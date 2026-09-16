import type { RefreshTokenRepository } from '../repository';
import { getSupabaseClient } from './client';

export class SupabaseRefreshTokenRepository implements RefreshTokenRepository {
  async store(params: { jti: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.from('refresh_tokens').insert({
      jti: params.jti,
      user_id: params.userId,
      token_hash: params.tokenHash,
      expires_at: params.expiresAt.toISOString(),
      revoked_at: null,
    });
    if (error) throw error;
  }

  async findByJti(jti: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('refresh_tokens').select('*').eq('jti', jti).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      jti: data.jti,
      userId: data.user_id,
      tokenHash: data.token_hash,
      expiresAt: new Date(data.expires_at),
      revokedAt: data.revoked_at ? new Date(data.revoked_at) : null,
    };
  }

  async revoke(jti: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.from('refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('jti', jti);
    if (error) throw error;
  }
}
