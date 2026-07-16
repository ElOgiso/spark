// ── Recovery Intelligence ─────────────────────────────────────────────
// Directs failover mechanisms when a provider fails or budgets are exceeded.
// Singleton – obtain via RecoveryIntelligence.getInstance().

import { ExecutionTask } from '../../domain/runtime/ExecutionTask';

export type RecoveryStrategy =
  | 'Retry'
  | 'ChangeProvider'
  | 'SimplifyStoryboard'
  | 'ReduceQuality'
  | 'AskUser'
  | 'Abort';

export class RecoveryIntelligence {
  private static instance: RecoveryIntelligence;

  private constructor() {}

  public static getInstance(): RecoveryIntelligence {
    if (!RecoveryIntelligence.instance) {
      RecoveryIntelligence.instance = new RecoveryIntelligence();
    }
    return RecoveryIntelligence.instance;
  }

  /**
   * Evaluates a failure and returns the recommended recovery strategy.
   */
  public evaluateFailure(
    task: ExecutionTask,
    errorMsg: string,
    attempt: number
  ): RecoveryStrategy {
    console.warn(`[RecoveryIntelligence] Evaluated failure on task ${task.id} (Attempt #${attempt}): ${errorMsg}`);

    if (attempt >= 3) {
      return 'AskUser';
    }

    if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('key') || errorMsg.includes('auth')) {
      return 'ChangeProvider';
    }

    if (errorMsg.includes('timeout') || errorMsg.includes('disconnect')) {
      return 'Retry';
    }

    if (errorMsg.includes('render') || errorMsg.includes('oom') || errorMsg.includes('memory')) {
      return 'ReduceQuality';
    }

    return 'Retry';
  }
}
