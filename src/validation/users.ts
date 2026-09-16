import { z } from 'zod';

export const banUserSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required'),
});

export const xpAdjustmentSchema = z.object({
  delta: z.number().refine((v) => v !== 0, 'delta must not be 0'),
  reason: z.string().trim().min(1, 'reason is required'),
});
