import type { Response } from 'express';
import type { ApiResponse } from '../types/api';

export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  res.status(status).json(body);
}

export function fail(res: Response, status: number, code: string, message: string): void {
  const body: ApiResponse<never> = { success: false, error: { code, message } };
  res.status(status).json(body);
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string, code = 'bad_request') {
    return new ApiError(400, code, message);
  }
  static unauthorized(message = 'Unauthorized', code = 'unauthorized') {
    return new ApiError(401, code, message);
  }
  static forbidden(message = 'Forbidden', code = 'forbidden') {
    return new ApiError(403, code, message);
  }
  static notFound(message = 'Not found', code = 'not_found') {
    return new ApiError(404, code, message);
  }
}
