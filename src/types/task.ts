export type TaskType = 'daily' | 'weekly' | 'monthly' | 'one_time';
export type TaskStatus = 'active' | 'inactive';
export type VerificationMethod = 'manual' | 'gps_tracked' | 'health_sync' | 'photo_review';
export type RewardEligibility = 'standard' | 'bonus' | 'premium';

export type VerificationConfig = {
  requiresNote?: boolean;
  gpsMinDistanceKm?: number;
  gpsMaxDurationMin?: number;
  healthMetric?: 'steps' | 'heart_rate' | 'sleep_hours' | 'calories';
  healthSyncProvider?: 'apple_health' | 'google_fit' | 'fitbit';
  photoRequiresTimestamp?: boolean;
  photoInstructions?: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  tag: string;
  imageUrl: string | null;
  type: TaskType;
  isDefaultDaily: boolean;
  recurrenceDays: string[] | null;
  startDate: string | null;
  endDate: string | null;
  levelTarget: number | null;
  targetValue: number;
  targetUnit: string;
  allowsPartial: boolean;
  xpPartial: number | null;
  xpReward: number;
  verificationMethod: VerificationMethod;
  verificationConfig: VerificationConfig;
  rewardEligibility: RewardEligibility;
  status: TaskStatus;
  createdAt: string;
};

export type TaskStats = {
  totalTasks: number;
  activeTasks: number;
  pendingReviews: number;
  avgXpReward: number;
  completionsToday: number;
};

export type TaskCompletionLogEntry = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  date: string;
  valueAchieved: number;
  verificationStatus: 'approved' | 'pending' | 'rejected';
};

export type TaskAssignmentStats = {
  usersAssigned: number;
  completionRate: number;
  avgCompletionTimeMin: number;
};

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'rewardEligibility'>;

export type PendingReviewItem = {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  userName: string;
  submittedValue: number;
  submittedUnit: string;
  submittedAt: string;
  verificationMethod: VerificationMethod;
  gpsSessionSummary: string | null;
  photoUrl: string | null;
  flagReason: string;
  status: 'pending' | 'approved' | 'rejected';
};
