import type { TaskRepository } from '../repository';
import type { Task, TaskInput, TaskStats, TaskCompletionLogEntry, TaskAssignmentStats } from '../../types/task';
import { memoryStore } from './store';
import { deriveRewardEligibility } from './seed';

let nextTaskSeq = 3000;

export class MemoryTaskRepository implements TaskRepository {
  async findAll(): Promise<Task[]> {
    await memoryStore.ensureSeeded();
    return memoryStore.tasks;
  }

  async findById(id: string): Promise<Task | null> {
    await memoryStore.ensureSeeded();
    return memoryStore.tasks.find((t) => t.id === id) ?? null;
  }

  async create(input: TaskInput): Promise<Task> {
    await memoryStore.ensureSeeded();
    const task: Task = {
      ...input,
      id: `tsk_${nextTaskSeq++}`,
      rewardEligibility: deriveRewardEligibility(input.xpReward, input.verificationMethod),
      createdAt: new Date().toISOString(),
    };
    memoryStore.tasks.push(task);
    return task;
  }

  async update(id: string, input: TaskInput): Promise<Task | null> {
    await memoryStore.ensureSeeded();
    const index = memoryStore.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;
    const updated: Task = {
      ...memoryStore.tasks[index],
      ...input,
      rewardEligibility: deriveRewardEligibility(input.xpReward, input.verificationMethod),
    };
    memoryStore.tasks[index] = updated;
    return updated;
  }

  async getStats(): Promise<TaskStats> {
    await memoryStore.ensureSeeded();
    const tasks = memoryStore.tasks;
    const active = tasks.filter((t) => t.status === 'active');
    return {
      totalTasks: tasks.length,
      activeTasks: active.length,
      pendingReviews: memoryStore.reviews.filter((r) => r.status === 'pending').length,
      avgXpReward: tasks.length ? Math.round(tasks.reduce((sum, t) => sum + t.xpReward, 0) / tasks.length) : 0,
      completionsToday: 47,
    };
  }

  async getCompletions(taskId: string): Promise<TaskCompletionLogEntry[]> {
    await memoryStore.ensureSeeded();
    return memoryStore.completions.filter((c) => c.taskId === taskId);
  }

  async getAssignmentStats(taskId: string): Promise<TaskAssignmentStats> {
    await memoryStore.ensureSeeded();
    const logs = memoryStore.completions.filter((c) => c.taskId === taskId);
    const approved = logs.filter((l) => l.verificationStatus === 'approved').length;
    return {
      usersAssigned: 40 + logs.length * 12,
      completionRate: logs.length ? Math.round((approved / logs.length) * 100) : 0,
      avgCompletionTimeMin: 25 + (taskId.length % 20),
    };
  }
}
