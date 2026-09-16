import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

/** Parses req.body against the given schema; replaces req.body with the parsed (typed, defaulted) result. */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}
