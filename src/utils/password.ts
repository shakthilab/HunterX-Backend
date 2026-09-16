import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashToken(token: string): Promise<string> {
  // Refresh tokens are long random-ish JWTs; a lighter cost factor is fine since
  // they're already high entropy, but we reuse bcrypt for consistency.
  return bcrypt.hash(token, 8);
}

export async function compareToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
