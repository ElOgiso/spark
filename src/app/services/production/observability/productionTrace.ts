/**
 * SPARK Phase 17 — Production Trace Rebuilder.
 * Reconstructs the end-to-end evidence trail for any production:
 * Plan → Route → Attempts → Cost → Assets → QC → Repairs → Editorial → Master → Publish → Performance
 */

import type { ProductionObservationEvent } from "./types";
import type { IProductionObservabilityRepository } from "./repository";
import { getProductionObservabilityRepository } from "./repository";

export interface ProductionTraceExecution {
  executionId: string;
  taskId: string;
  providerId: string;
  modelId?: string;
  attempt: number;
  status: string;
  durationMs?: number;
  failureCategory?: string;
  providerJobId?: string;
  isUnknownSubmission: boolean;
  assetProducedId?: string;
  occurredAt: string;
}

export interface ProductionTraceRepair {
  originalAssetId: string;
  failureCode?: string;
  repairAction?: string;
  replacementAssetId?: string;
  secondQcVerdict?: string;
  secondQcScore?: number;
  succeeded: boolean;
}

export interface ProductionTrace {
  productionId: string;
  brandId?: string;
  plan?: {
    idea?: string;
    mode?: string;
    formatDirection?: string;
    targetDurationSec?: number;
    sceneCount: number;
    shotCount: number;
    taskCount: number;
    scenes: Array<{ sceneId: string; shotIds: string[] }>;
  };
  routes: Array<{
    taskId: string;
    providerId: string;
    modelId?: string;
    reason?: string;
    fallbacks?: string[];
  }>;
  executions: ProductionTraceExecution[];
  economics: {
    estimatedCostUsd?: number;
    actualCostUsd?: number;
    actualCostStatus: "measured" | "unknown" | "free";
    creditsReserved: number;
    creditsConsumed: number;
    creditsReleased: number;
    creditsRefunded: number;
    isPendingUnknown: boolean;
    reservations: Array<{
      id: string;
      generationId?: string;
      amount: number;
      status: string;
      consumedAmount: number;
      releasedAmount: number;
    }>;
  };
  assets: Array<{
    assetId: string;
    taskId?: string;
    shotId?: string;
    sceneId?: string;
    provider?: string;
    url?: string;
    status: string;
  }>;
  qc: Array<{
    assetId: string;
    verdict: string;
    score?: number;
    failureCodes: string[];
    recommendedAction?: string;
  }>;
  repairs: ProductionTraceRepair[];
  editorial?: {
    timelineId?: string;
    assembled: boolean;
    decision?: string;
  };
  master?: {
    masterId?: string;
    mediaUrl?: string;
    status?: string;
    durationSec?: number;
  };
  publish?: {
    published: boolean;
    platform?: string;
    publishJobId?: string;
    status?: string;
    publishedUrl?: string;
  };
  performance: {
    performanceStatus: "measured" | "not_available";
    snapshots: Array<{
      metricName: string;
      value: number;
      platform?: string;
      observedAt: string;
    }>;
  };
  events: ProductionObservationEvent[];
}

export async function buildProductionTrace(
  productionId: string,
  repository?: IProductionObservabilityRepository
): Promise<ProductionTrace> {
  const repo = repository || getProductionObservabilityRepository();
  const events = await repo.byProduction(productionId);

  // Sort chronologically
  events.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  let brandId: string | undefined;
  let plan: ProductionTrace["plan"];
  const routes: ProductionTrace["routes"] = [];
  const executions: ProductionTraceExecution[] = [];
  const assets: ProductionTrace["assets"] = [];
  const qcList: ProductionTrace["qc"] = [];
  const repairs: ProductionTraceRepair[] = [];
  let editorial: ProductionTrace["editorial"];
  let master: ProductionTrace["master"];
  let publish: ProductionTrace["publish"];
  const perfSnapshots: ProductionTrace["performance"]["snapshots"] = [];

  // Economics accumulators
  let estimatedCostUsd: number | undefined;
  let actualCostUsd: number | undefined;
  let actualCostStatus: "measured" | "unknown" | "free" = "unknown";
  let creditsReserved = 0;
  let creditsConsumed = 0;
  let creditsReleased = 0;
  let creditsRefunded = 0;
  let isPendingUnknown = false;
  const reservationMap = new Map<string, ProductionTrace["economics"]["reservations"][0]>();

  for (const ev of events) {
    if (ev.brandId && !brandId) {
      brandId = ev.brandId;
    }

    switch (ev.eventType) {
      case "production_planned": {
        plan = {
          idea: (ev.evidence.idea as string) || undefined,
          mode: (ev.evidence.mode as string) || undefined,
          formatDirection: (ev.evidence.formatDirection as string) || undefined,
          targetDurationSec: (ev.evidence.targetDurationSec as number) || undefined,
          sceneCount: (ev.evidence.sceneCount as number) || 0,
          shotCount: (ev.evidence.shotCount as number) || 0,
          taskCount: (ev.evidence.taskCount as number) || 0,
          scenes: (ev.evidence.scenes as any[]) || [],
        };
        break;
      }

      case "mode_selected": {
        if (plan) plan.mode = (ev.evidence.mode as string) || plan.mode;
        break;
      }

      case "format_direction_selected": {
        if (plan) plan.formatDirection = (ev.evidence.formatDirection as string) || plan.formatDirection;
        break;
      }

      case "routing_selected":
      case "routing_evaluated": {
        if (ev.taskId && ev.providerId) {
          routes.push({
            taskId: ev.taskId,
            providerId: ev.providerId,
            modelId: ev.modelId,
            reason: ev.evidence.reason as string | undefined,
            fallbacks: ev.evidence.fallbacks as string[] | undefined,
          });
        }
        break;
      }

      case "cost_estimated": {
        if (typeof ev.evidence.estimatedCostUsd === "number") {
          estimatedCostUsd = ev.evidence.estimatedCostUsd;
        }
        break;
      }

      case "provider_cost_recorded": {
        if (typeof ev.evidence.actualCostUsd === "number") {
          actualCostUsd = ev.evidence.actualCostUsd;
          actualCostStatus = actualCostUsd === 0 ? "free" : "measured";
        } else if (ev.evidence.actualCostStatus === "unknown") {
          actualCostStatus = "unknown";
          actualCostUsd = undefined;
        }
        break;
      }

      case "credits_reserved": {
        const amt = (ev.evidence.amount as number) || 0;
        creditsReserved += amt;
        if (ev.reservationId) {
          reservationMap.set(ev.reservationId, {
            id: ev.reservationId,
            generationId: (ev.evidence.generationId as string) || ev.productionId,
            amount: amt,
            status: "RESERVED",
            consumedAmount: 0,
            releasedAmount: 0,
          });
        }
        break;
      }

      case "credits_settled": {
        const consumed = (ev.evidence.consumedAmount as number) ?? (ev.evidence.amount as number) ?? 0;
        const released = (ev.evidence.releasedAmount as number) || 0;
        creditsConsumed += consumed;
        creditsReleased += released;
        if (ev.reservationId && reservationMap.has(ev.reservationId)) {
          const res = reservationMap.get(ev.reservationId)!;
          res.status = "CONSUMED";
          res.consumedAmount = consumed;
          res.releasedAmount = released;
        }
        if (typeof ev.evidence.actualProviderCostUsd === "number") {
          actualCostUsd = ev.evidence.actualProviderCostUsd;
          actualCostStatus = actualCostUsd === 0 ? "free" : "measured";
        }
        break;
      }

      case "credits_released": {
        const rel = (ev.evidence.amount as number) || 0;
        creditsReleased += rel;
        if (ev.reservationId && reservationMap.has(ev.reservationId)) {
          const res = reservationMap.get(ev.reservationId)!;
          res.status = "RELEASED";
          res.releasedAmount = rel;
        }
        break;
      }

      case "credits_pending_unknown": {
        isPendingUnknown = true;
        if (ev.reservationId && reservationMap.has(ev.reservationId)) {
          reservationMap.get(ev.reservationId)!.status = "PENDING_UNKNOWN";
        }
        break;
      }

      case "credits_refunded": {
        const ref = (ev.evidence.amount as number) || 0;
        creditsRefunded += ref;
        if (ev.reservationId && reservationMap.has(ev.reservationId)) {
          reservationMap.get(ev.reservationId)!.status = "REFUNDED";
        }
        break;
      }

      case "execution_queued":
      case "execution_submitting":
      case "execution_submitted":
      case "execution_running":
      case "execution_succeeded":
      case "execution_failed":
      case "execution_cancelled":
      case "execution_unknown_submission": {
        const isUnknown =
          ev.eventType === "execution_unknown_submission" ||
          ev.evidence.failureCode === "UNKNOWN_SUBMISSION" ||
          ev.evidence.status === "unknown_submission";

        let status = ev.eventType.replace("execution_", "");
        if (isUnknown) {
          status = "unknown_submission";
        }

        const existingExec = executions.find(
          (x) => x.executionId === ev.executionId && x.attempt === (ev.attempt || 1)
        );

        if (existingExec) {
          existingExec.status = status;
          if (ev.evidence.durationMs) existingExec.durationMs = ev.evidence.durationMs as number;
          if (ev.evidence.failureCategory || ev.evidence.failureCode) {
            existingExec.failureCategory = (ev.evidence.failureCategory || ev.evidence.failureCode) as string;
          }
          if (ev.providerJobId) existingExec.providerJobId = ev.providerJobId;
          if (isUnknown) existingExec.isUnknownSubmission = true;
          if (ev.assetId) existingExec.assetProducedId = ev.assetId;
        } else {
          executions.push({
            executionId: ev.executionId || `exec_${Date.now()}`,
            taskId: ev.taskId || "unknown_task",
            providerId: ev.providerId || "unknown_provider",
            modelId: ev.modelId,
            attempt: ev.attempt || 1,
            status,
            durationMs: ev.evidence.durationMs as number | undefined,
            failureCategory: (ev.evidence.failureCategory || ev.evidence.failureCode) as string | undefined,
            providerJobId: ev.providerJobId,
            isUnknownSubmission: isUnknown,
            assetProducedId: ev.assetId,
            occurredAt: ev.occurredAt,
          });
        }

        if (ev.assetId && !assets.some((a) => a.assetId === ev.assetId)) {
          assets.push({
            assetId: ev.assetId,
            taskId: ev.taskId,
            shotId: ev.shotId,
            sceneId: ev.sceneId,
            provider: ev.providerId,
            url: ev.evidence.url as string | undefined,
            status: status === "succeeded" ? "completed" : "pending",
          });
        }
        break;
      }

      case "qc_evaluated":
      case "qc_passed":
      case "qc_failed":
      case "qc_needs_review": {
        if (ev.assetId) {
          const verdict = (ev.evidence.verdict as string) || (ev.eventType === "qc_passed" ? "pass" : "fail");
          qcList.push({
            assetId: ev.assetId,
            verdict,
            score: ev.evidence.score as number | undefined,
            failureCodes: (ev.evidence.failureCodes as string[]) || [],
            recommendedAction: ev.evidence.recommendedAction as string | undefined,
          });
        }
        break;
      }

      case "repair_decided":
      case "repair_attempted":
      case "repair_succeeded":
      case "repair_failed": {
        const origAsset = (ev.evidence.originalAssetId as string) || ev.assetId || "unknown_asset";
        const replAsset = (ev.evidence.replacementAssetId as string) || undefined;
        const failureCode = (ev.evidence.failureCode as string) || undefined;
        const repairAction = (ev.evidence.repairAction as string) || undefined;
        const succeeded = ev.eventType === "repair_succeeded" || ev.evidence.succeeded === true;

        const existingRepair = repairs.find(
          (r) => r.originalAssetId === origAsset && (!replAsset || r.replacementAssetId === replAsset)
        );

        if (existingRepair) {
          if (replAsset) existingRepair.replacementAssetId = replAsset;
          if (ev.evidence.secondQcVerdict) {
            existingRepair.secondQcVerdict = ev.evidence.secondQcVerdict as string;
          }
          if (ev.evidence.secondQcScore) {
            existingRepair.secondQcScore = ev.evidence.secondQcScore as number;
          }
          existingRepair.succeeded = succeeded;
        } else {
          repairs.push({
            originalAssetId: origAsset,
            failureCode,
            repairAction,
            replacementAssetId: replAsset,
            secondQcVerdict: ev.evidence.secondQcVerdict as string | undefined,
            secondQcScore: ev.evidence.secondQcScore as number | undefined,
            succeeded,
          });
        }
        break;
      }

      case "editorial_started":
      case "editorial_assembled": {
        editorial = {
          timelineId: ev.evidence.timelineId as string | undefined,
          assembled: ev.eventType === "editorial_assembled",
          decision: ev.evidence.decision as string | undefined,
        };
        break;
      }

      case "mastering_started":
      case "mastering_succeeded":
      case "mastering_failed":
      case "mastering_deferred": {
        master = {
          masterId: (ev.evidence.masterId as string) || ev.assetId,
          mediaUrl: ev.evidence.mediaUrl as string | undefined,
          status: ev.eventType.replace("mastering_", ""),
          durationSec: ev.evidence.durationSec as number | undefined,
        };
        break;
      }

      case "publish_completed":
      case "publish_queued":
      case "publish_failed": {
        publish = {
          published: ev.eventType === "publish_completed",
          platform: ev.evidence.platform as string | undefined,
          publishJobId: (ev.evidence.publishJobId as string) || ev.id,
          status: ev.eventType.replace("publish_", ""),
          publishedUrl: ev.evidence.publishedUrl as string | undefined,
        };
        break;
      }

      case "analytics_captured":
      case "performance_recorded": {
        if (ev.evidence.metricName && typeof ev.evidence.value === "number") {
          perfSnapshots.push({
            metricName: ev.evidence.metricName as string,
            value: ev.evidence.value as number,
            platform: ev.evidence.platform as string | undefined,
            observedAt: ev.occurredAt,
          });
        }
        break;
      }
    }
  }

  const performanceStatus = perfSnapshots.length > 0 ? "measured" : "not_available";

  return {
    productionId,
    brandId,
    plan,
    routes,
    executions,
    economics: {
      estimatedCostUsd,
      actualCostUsd,
      actualCostStatus,
      creditsReserved,
      creditsConsumed,
      creditsReleased,
      creditsRefunded,
      isPendingUnknown,
      reservations: [...reservationMap.values()],
    },
    assets,
    qc: qcList,
    repairs,
    editorial,
    master,
    publish,
    performance: {
      performanceStatus,
      snapshots: perfSnapshots,
    },
    events,
  };
}
