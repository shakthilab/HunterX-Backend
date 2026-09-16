import { randomUUID } from 'crypto';
import { getRepositories } from '../db';
import { comparePassword, hashToken, compareToken } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { ApiError } from '../utils/response';
import type { User } from '../types/user';

// Bookkeeping expiry for the stored refresh-token row; kept in sync with the
// JWT_REFRESH_EXPIRES_IN default (30d) used to sign the token itself.
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role ?? 'user', email: user.email });
  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  const tokenHash = await hashToken(refreshToken);
  await getRepositories().refreshTokens.store({
    jti,
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return { accessToken, refreshToken };
}

export async function login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  const repos = getRepositories();
  const userWithHash = await repos.users.findByEmailWithPassword(email);
  if (!userWithHash) throw ApiError.unauthorized('Invalid email or password', 'invalid_credentials');

  const passwordMatches = await comparePassword(password, userWithHash.passwordHash);
  if (!passwordMatches) throw ApiError.unauthorized('Invalid email or password', 'invalid_credentials');

  if (userWithHash.role !== 'admin') {
    throw ApiError.forbidden('Access denied: admin role required', 'not_admin');
  }

  const { passwordHash: _passwordHash, ...user } = userWithHash;
  const tokens = await issueTokens(user);
  return { user, ...tokens };
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token', 'invalid_refresh_token');
  }

  const repos = getRepositories();
  const record = await repos.refreshTokens.findByJti(payload.jti);
  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized('Invalid or expired refresh token', 'invalid_refresh_token');
  }

  const tokenMatches = await compareToken(refreshToken, record.tokenHash);
  if (!tokenMatches) {
    throw ApiError.unauthorized('Invalid or expired refresh token', 'invalid_refresh_token');
  }

  // Rotate: the presented token is single-use.
  await repos.refreshTokens.revoke(payload.jti);

  const user = await repos.users.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists', 'invalid_refresh_token');

  return issueTokens(user);
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await getRepositories().refreshTokens.revoke(payload.jti);
  } catch {
    // Already invalid/expired/malformed: logout is idempotent, nothing to revoke.
  }
}
