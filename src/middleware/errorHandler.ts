import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, fail } from '../utils/response';

export function notFoundHandler(req: Request, res: Response): void {
  fail(res, 404, 'not_found', `No route for ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`).join('; ');
    fail(res, 400, 'validation_error', message);
    return;
  }

  if (err instanceof ApiError) {
    fail(res, err.status, err.code, err.message);
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[unhandled error]', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  fail(res, 500, 'internal_error', message);
}
