/**
 * Phase 6 production editorial entry — assemble → validate → decide → (optional) master.
 */

import type { ProductionAsset } from "../../../domain/types";
import type { ProductionSpec } from "../specification/productionSpec";
import type { ProductionQcVerdict, SparkAutomationMode } from "../qc/types";
import { assembleEditorialTimeline, type AssembleEditorialOptions } from "./assembly";
import { validateEditorialTimeline } from "./validation";
import { decideEditorialAction, type EditorialDecision } from "./decisionEngine";
import type { EditorialTimeline, DeliveryVariant } from "./types";
import type { EditorialValidationResult } from "./validation";
import {
  createMasteringService,
  type MasteringServiceOptions,
} from "./mastering/masteringService";
import type { MasteringResult } from "./mastering/types";
import { createMockMasteringAdapter } from "./mastering/ffmpegAdapter";

export interface RunEditorialPipelineOptions extends AssembleEditorialOptions {
  automationMode?: SparkAutomationMode;
  /** Attempt mastering when decision allows */
  master?: boolean;
  variantId?: string;
  brandId?: string;
  mastering?: MasteringServiceOptions;
}

export interface EditorialPipelineResult {
  timeline: EditorialTimeline;
  validation: EditorialValidationResult;
  decision: EditorialDecision;
  mastering?: MasteringResult;
  ok: boolean;
}

export async function runEditorialPipeline(
  spec: ProductionSpec,
  options: RunEditorialPipelineOptions = {}
): Promise<EditorialPipelineResult> {
  const timeline = assembleEditorialTimeline(spec, options);
  const validation = validateEditorialTimeline(timeline, spec);
  const decision = decideEditorialAction({
    timeline,
    validation,
    automationMode: options.automationMode,
  });

  let mastering: MasteringResult | undefined;

  if (options.master && decision.allowMaster) {
    const variant =
      timeline.variants.find((v) => v.id === options.variantId) || timeline.variants[0];
    if (variant) {
      const service = createMasteringService(
        options.mastering || { adapter: createMockMasteringAdapter() }
      );
      const job = await service.createJob({
        timeline,
        variant,
        productionId: spec.project.id,
        brandId: options.brandId,
      });
      mastering = await service.executeJob(job, {
        timeline,
        variant,
        productionId: spec.project.id,
        brandId: options.brandId,
      });
      if (mastering.ok) {
        timeline.status = "mastered";
        timeline.userMessage = mastering.userMessage;
        timeline.updatedAt = new Date().toISOString();
      } else if (!mastering.deferred) {
        timeline.status = "failed";
        timeline.userMessage = mastering.userMessage;
      } else {
        timeline.status = "ready_for_master";
      }
    }
  }

  return {
    timeline,
    validation,
    decision,
    mastering,
    ok: decision.allowMaster && validation.status !== "invalid" && (mastering ? mastering.ok : true),
  };
}

export function pickVariant(
  timeline: EditorialTimeline,
  variantId?: string
): DeliveryVariant | undefined {
  if (variantId) return timeline.variants.find((v) => v.id === variantId);
  return timeline.variants[0];
}

export type { ProductionAsset, ProductionQcVerdict };
