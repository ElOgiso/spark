import { ExecutionTask } from "../domain/runtime/ExecutionTask";
import { TaskState } from "../domain/runtime/TaskState";

export class TaskScheduler {
  private static instance: TaskScheduler;
  private queue: ExecutionTask[] = [];

  private constructor() {}

  public static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  /**
   * Pushes a task to the queue and re-sorts by priority.
   */
  public enqueue(task: ExecutionTask): void {
    task.status = TaskState.QUEUED;
    this.queue.push(task);
    this.sortQueue();
    console.log(`[Task Scheduler] TaskQueued: Enqueued task ${task.id} (Priority: ${task.priority})`);
  }

  /**
   * Sorts queue by priority (high > medium > low), then FIFO by creation timestamp.
   */
  private sortQueue(): void {
    const priorityWeights = { high: 3, medium: 2, low: 1 };
    
    this.queue.sort((a, b) => {
      const weightA = priorityWeights[a.priority] || 2;
      const weightB = priorityWeights[b.priority] || 2;
      
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  /**
   * Evaluates queue constraints and pops the next executable task.
   * Gated by: unresolved dependencies, scheduled execution time, and delay thresholds.
   */
  public getNextTask(completedTaskIds: Set<string>): ExecutionTask | null {
    const now = new Date();

    for (let i = 0; i < this.queue.length; i++) {
      const task = this.queue[i];

      if (task.status !== TaskState.QUEUED) {
        continue;
      }

      // Check delayed execution ms
      if (task.delayMs && task.delayMs > 0) {
        const timeElapsed = now.getTime() - new Date(task.createdAt).getTime();
        if (timeElapsed < task.delayMs) {
          continue;
        }
      }

      // Check scheduled execution time
      if (task.scheduledTime) {
        const scheduled = new Date(task.scheduledTime);
        if (now < scheduled) {
          continue;
        }
      }

      // Check dependency ordering
      if (task.dependencies && task.dependencies.length > 0) {
        const hasUnresolvedDeps = task.dependencies.some(depId => !completedTaskIds.has(depId));
        if (hasUnresolvedDeps) {
          continue;
        }
      }

      // Remove and return candidate
      this.queue.splice(i, 1);
      return task;
    }

    return null;
  }

  public getQueue(): ExecutionTask[] {
    return [...this.queue];
  }

  public clearQueue(): void {
    this.queue = [];
  }
}
