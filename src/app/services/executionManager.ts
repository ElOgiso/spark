import { ExecutionTask } from "../domain/runtime/ExecutionTask";
import { TaskState } from "../domain/runtime/TaskState";
import { PerformanceHistory } from "./performanceHistory";
import { ProviderSelection } from "./modelRouter";
import { AgentResult } from "../domain/runtime/AgentResult";
import { IDepartmentAgent } from "../domain/runtime/IDepartmentAgent";
import { SharedExecutionContext } from "./runtime/sharedExecutionContext";
import { ContextBuilder } from "./workspace/contextBuilder";

export interface ExecutionMetrics {
  executionTimeMs: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  qualityRating?: number;
}

export class ExecutionManager {
  private static instance: ExecutionManager;
  private activeTasks: Map<string, ExecutionTask> = new Map();
  private completedTaskIds: Set<string> = new Set();
  private taskStartTimes: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): ExecutionManager {
    if (!ExecutionManager.instance) {
      ExecutionManager.instance = new ExecutionManager();
    }
    return ExecutionManager.instance;
  }

  public getCompletedTaskIds(): Set<string> {
    return this.completedTaskIds;
  }

  /**
   * Executes the task by running it through the IDepartmentAgent lifecycle methods.
   * Gated by agent validation.
   */
  public async executeTask(
    task: ExecutionTask,
    selection: ProviderSelection,
    agent: IDepartmentAgent,
    sharedCtx?: SharedExecutionContext,
    onChunk?: (text: string) => void
  ): Promise<AgentResult> {
    this.startTask(task);
    try {
      await agent.initialize();
      await agent.prepare(task);
      
      const context = ContextBuilder.build(task, sharedCtx);
      
      const result = await agent.execute(task, context, selection, onChunk);
      
      if (sharedCtx) {
        for (const [k, v] of Object.entries(context.sharedDataSnapshot)) {
          sharedCtx.set(k, v);
        }
      }

      const isValid = agent.validate(result);
      if (!isValid) {
        throw new Error(`Execution verification failed under agent validation rules.`);
      }

      await agent.cleanup();
      this.completeTask(task, result.metrics);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      this.failTask(task, errorMsg);
      await agent.cleanup().catch(() => {});
      throw err;
    }
  }

  public startTask(task: ExecutionTask): void {
    task.status = TaskState.RUNNING;
    this.activeTasks.set(task.id, task);
    this.taskStartTimes.set(task.id, Date.now());
    console.log(`[Execution Manager] TaskStarted: Executing task ${task.id} (Objective: "${task.objective}")`);
  }

  public pauseTask(task: ExecutionTask): void {
    if (task.status === TaskState.RUNNING) {
      task.status = TaskState.PAUSED;
      console.log(`[Execution Manager] TaskPaused: Suspended task ${task.id}`);
    }
  }

  public resumeTask(task: ExecutionTask): void {
    if (task.status === TaskState.PAUSED) {
      task.status = TaskState.RUNNING;
      console.log(`[Execution Manager] TaskResumed: Resumed execution of task ${task.id}`);
    }
  }

  public cancelTask(task: ExecutionTask): void {
    task.status = TaskState.CANCELLED;
    this.activeTasks.delete(task.id);
    this.taskStartTimes.delete(task.id);
    console.log(`[Execution Manager] TaskCancelled: Aborted task ${task.id}`);
  }

  public triggerTimeout(task: ExecutionTask): void {
    task.status = TaskState.TIMED_OUT;
    this.activeTasks.delete(task.id);
    this.taskStartTimes.delete(task.id);
    console.log(`[Execution Manager] TaskTimedOut: Execution exceeded deadline constraints for task ${task.id}`);
  }

  public retryTask(task: ExecutionTask, attemptCount: number): void {
    task.status = TaskState.RETRYING;
    console.log(`[Execution Manager] TaskRetried: Re-attempting execution of task ${task.id} (Attempt #${attemptCount})`);
  }

  public completeTask(task: ExecutionTask, metrics?: Partial<ExecutionMetrics>): void {
    task.status = TaskState.COMPLETED;
    this.activeTasks.delete(task.id);
    this.completedTaskIds.add(task.id);
    
    const startTime = this.taskStartTimes.get(task.id);
    const latency = startTime ? Date.now() - startTime : 0;
    this.taskStartTimes.delete(task.id);

    console.log(`[Execution Manager] TaskCompleted: Successfully finalized task ${task.id}. Execution time: ${latency}ms`);
    
    this.collectMetrics(task, {
      executionTimeMs: latency,
      ...metrics
    });
  }

  public failTask(task: ExecutionTask, errorReason: string): void {
    task.status = TaskState.FAILED;
    this.activeTasks.delete(task.id);
    this.taskStartTimes.delete(task.id);
    console.log(`[Execution Manager] TaskFailed: Execution failed for task ${task.id}. Reason: "${errorReason}"`);
  }

  private collectMetrics(task: ExecutionTask, metrics: Partial<ExecutionMetrics>): void {
    console.log(`[Execution Manager] MetricsCollected: Task ${task.id} metrics: Latency=${metrics.executionTimeMs}ms, Cost=$${metrics.costUsd || 0.0}`);
  }
}
