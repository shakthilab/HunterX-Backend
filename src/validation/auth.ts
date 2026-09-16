import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'email is required').email('email must be a valid email address'),
  password: z.string().min(1, 'password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});
