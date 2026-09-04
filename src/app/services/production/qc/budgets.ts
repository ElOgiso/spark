/**
 * Regeneration / QC attempt budgets — prevent infinite QC→regenerate loops.
 */

import type { QualitySpec } from "../specification/qualitySpec";
import type { QcBudgetState } from "./types";

export interface QcBudgetConfig {
  maxQcRetries: number;
  maxProviderChanges: number;
  maxTotalExecutionAttempts: number;
  maxAttemptsPerTask: number;
}

export function createDefaultQcBudget(quality?: QualitySpec): QcBudgetConfig {
  const perShot = quality?.maxRetriesPerShot ?? 2;
  return {
    maxQcRetries: Math.max(1, perShot),
    maxProviderChanges: 2,
    maxTotalExecutionAttempts: Math.max(3, perShot + 2),
    maxAttemptsPerTask: Math.max(2, perShot + 1),
  };
}

export function createBudgetState(config: QcBudgetConfig = createDefaultQcBudget()): QcBudgetState {
  return {
    qcRetries: 0,
    maxQcRetries: config.maxQcRetries,
    providerChanges: 0,
    maxProviderChanges: config.maxProviderChanges,
    totalExecutionAttempts: 0,
    maxTotalExecutionAttempts: config.maxTotalExecutionAttempts,
    exhausted: false,
  };
}

export function canRetryQc(budget: QcBudgetState): boolean {
  return (
    !budget.exhausted &&
    budget.qcRetries < budget.maxQcRetries &&
    budget.totalExecutionAttempts < budget.maxTotalExecutionAttempts
  );
}

export function canChangeProvider(budget: QcBudgetState): boolean {
  return canRetryQc(budget) && budget.providerChanges < budget.maxProviderChanges;
}

export function recordQcRetry(budget: QcBudgetState, providerChanged: boolean): QcBudgetState {
  const next: QcBudgetState = {
    ...budget,
    qcRetries: budget.qcRetries + 1,
    totalExecutionAttempts: budget.totalExecutionAttempts + 1,
    providerChanges: budget.providerChanges + (providerChanged ? 1 : 0),
  };
  next.exhausted =
    next.qcRetries >= next.maxQcRetries ||
    next.totalExecutionAttempts >= next.maxTotalExecutionAttempts ||
    (providerChanged && next.providerChanges > next.maxProviderChanges);
  return next;
}

export function markBudgetExhausted(budget: QcBudgetState): QcBudgetState {
  return { ...budget, exhausted: true };
}
