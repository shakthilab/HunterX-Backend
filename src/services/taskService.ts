import { getRepositories } from '../db';
import { ApiError } from '../utils/response';
import type { Task, TaskInput, TaskStats, TaskCompletionLogEntry, TaskAssignmentStats, PendingReviewItem } from '../types/task';

export async function listTasks(): Promise<Task[]> {
  return getRepositories().tasks.findAll();
}

export async function getTask(id: string): Promise<Task> {
  const task = await getRepositories().tasks.findById(id);
  if (!task) throw ApiError.notFound(`Task ${id} not found`);
  return task;
}

export async function getTaskStats(): Promise<TaskStats> {
  return getRepositories().tasks.getStats();
}

export async function getTaskCompletions(id: string): Promise<TaskCompletionLogEntry[]> {
  await getTask(id); // 404s if the task doesn't exist
  return getRepositories().tasks.getCompletions(id);
}

export async function getTaskAssignmentStats(id: string): Promise<TaskAssignmentStats> {
  await getTask(id);
  return getRepositories().tasks.getAssignmentStats(id);
}

export async function listReviewQueue(): Promise<PendingReviewItem[]> {
  return getRepositories().reviews.findAll();
}

export async function decideReview(id: string, status: 'approved' | 'rejected'): Promise<PendingReviewItem> {
  const updated = await getRepositories().reviews.decide(id, status);
  if (!updated) throw ApiError.notFound(`Review ${id} not found`);
  return updated;
}

export async function createTask(input: TaskInput): Promise<Task> {
  return getRepositories().tasks.create(input);
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  const updated = await getRepositories().tasks.update(id, input);
  if (!updated) throw ApiError.notFound(`Task ${id} not found`);
  return updated;
}
