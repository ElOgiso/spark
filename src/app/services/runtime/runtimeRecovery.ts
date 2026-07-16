import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { RuntimeEvents } from "./runtimeEvents";
import { AdapterFactory } from "../providerAdapters";

export class RuntimeRecovery {
  private static retryBudget: Map<string, number> = new Map();
  private static deadLetterQueue: ExecutionTask[] = [];

  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_BACKOFF_MS = 500;

  /**
   * Executes with exponential backoff, automatic provider failover, and dead-letter queue.
   */
  public static async executeWithRetry<T>(
    task: ExecutionTask,
    selection: ProviderSelection,
    operation: () => Promise<T>,
    fallbackProviderSelection?: () => ProviderSelection
  ): Promise<T> {
    if (!this.retryBudget.has(task.id)) {
      this.retryBudget.set(task.id, this.MAX_RETRIES);
    }

    let remaining = this.retryBudget.get(task.id)!;
    const failoverProviders = AdapterFactory.getRegisteredProviders().filter(p => p !== selection.provider);

    while (remaining >= 0) {
      try {
        const result = await operation();
        if (remaining < this.MAX_RETRIES) {
          RuntimeEvents.getInstance().emit("RetrySucceeded", { taskId: task.id });
        }
        return result;
      } catch (err: any) {
        remaining--;
        this.retryBudget.set(task.id, remaining);

        if (remaining < 0) {
          this.deadLetterQueue.push(task);
          RuntimeEvents.getInstance().emit("RetryFailed", { taskId: task.id, error: err.message });
          throw new Error(`Max retry threshold exceeded for task ${task.id}. Pushed to DLQ.`);
        }

        // Attempt provider failover
        const failoverIndex = this.MAX_RETRIES - remaining - 1;
        if (failoverIndex < failoverProviders.length) {
          const oldProvider = selection.provider;
          const newProvider = failoverProviders[failoverIndex] as "openai" | "anthropic" | "google";
          selection.provider = newProvider;
          selection.model = AdapterFactory.getAdapter(newProvider).supportedModels[0];
          RuntimeEvents.getInstance().emit("ProviderFallback", {
            taskId: task.id,
            from: oldProvider,
            to: newProvider,
            attempt: this.MAX_RETRIES - remaining
          });
        } else if (fallbackProviderSelection) {
          const newSelection = fallbackProviderSelection();
          if (newSelection.provider !== selection.provider) {
            RuntimeEvents.getInstance().emit("ProviderChanged", {
              taskId: task.id,
              from: selection.provider,
              to: newSelection.provider
            });
            selection.provider = newSelection.provider;
            selection.model = newSelection.model;
          }
        }

        const delay = this.BASE_BACKOFF_MS * Math.pow(2, this.MAX_RETRIES - remaining);
        RuntimeEvents.getInstance().emit("RetryStarted", {
          taskId: task.id,
          attemptRemaining: remaining,
          backoffMs: delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Execution failed`);
  }

  public static getDeadLetterQueue(): ExecutionTask[] {
    return [...this.deadLetterQueue];
  }
}
