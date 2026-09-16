import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/response';

export type AuthedRequest = Request & {
  auth?: { userId: string; role: string; email: string };
};

/** Requires a valid access token. 401 if missing/invalid/expired. */
export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
}

/** Requires the authenticated user to have role 'admin'. 403 otherwise. Must run after requireAuth. */
export function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== 'admin') {
    throw ApiError.forbidden('Admin role required');
  }
  next();
}
