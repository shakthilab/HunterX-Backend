import { z } from 'zod';

const verificationConfigSchema = z
  .object({
    requiresNote: z.boolean().optional(),
    gpsMinDistanceKm: z.number().optional(),
    gpsMaxDurationMin: z.number().optional(),
    healthMetric: z.enum(['steps', 'heart_rate', 'sleep_hours', 'calories']).optional(),
    healthSyncProvider: z.enum(['apple_health', 'google_fit', 'fitbit']).optional(),
    photoRequiresTimestamp: z.boolean().optional(),
    photoInstructions: z.string().optional(),
  })
  .strict();

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1, 'description is required'),
  tag: z.string().trim().min(1, 'tag is required'),
  imageUrl: z.string().nullable(),
  type: z.enum(['daily', 'weekly', 'monthly', 'one_time']),
  isDefaultDaily: z.boolean(),
  recurrenceDays: z.array(z.string()).nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  levelTarget: z.number().nullable(),
  targetValue: z.number().positive('targetValue must be greater than 0'),
  targetUnit: z.string().trim().min(1, 'targetUnit is required'),
  allowsPartial: z.boolean(),
  xpPartial: z.number().nullable(),
  xpReward: z.number().nonnegative('xpReward must be 0 or greater'),
  verificationMethod: z.enum(['manual', 'gps_tracked', 'health_sync', 'photo_review']),
  verificationConfig: verificationConfigSchema,
  status: z.enum(['active', 'inactive']),
});

export const reviewDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
