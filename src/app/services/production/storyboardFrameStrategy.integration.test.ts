/**
 * Post-Phase-12 production integration acceptance tests.
 *
 * Proves:
 *   StoryboardSheet ≠ StoryboardFrame
 *   StoryboardFrame ≠ GeneratedStateFrame
 *   Frame strategy is capability-driven (no unsupported params)
 *   Continuation prefers observed LAST state temporally, keeps storyboard intent
 *   Publishing: autonomous ≠ always publish
 *   Duration is preserved through intent (frame strategy does not override it)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStoryboardFrameFromPanel,
  buildStoryboardSheetAsset,
  extractStoryboardFramesFromBlueprint,
  resolveStoryboardFrameForShot,
  compileIndividualStoryboardFramePrompt,
} from "./preproduction/storyboardFrame";
import type { StoryboardBlueprint, StoryboardPanelSpec } from "./preproduction/types";
import {
  resolveGenerationFrameStrategy,
  frameStrategyToVideoRequestFields,
  capabilityNeedsForFrameStrategy,
} from "./generation/frameStrategy";
import {
  buildGeneratedStateFrame,
  buildContinuityFrameHandoff,
  flagGeneratedStateVsPlan,
} from "./generation/generatedStateFrame";
import {
  evaluatePublishGate,
  buildPublishAuditRecord,
} from "./publishing/publishPolicy";

function makePanel(i: number, shotId: string): StoryboardPanelSpec {
  return {
    panelId: `panel_${String(i + 1).padStart(2, "0")}`,
    shotId,
    sequenceIndex: i,
    purpose: `Purpose ${i + 1}`,
    dramaticBeat: `Beat ${i + 1}`,
    visualObjective: `See subject clearly in beat ${i + 1}`,
    editorialRole: "story",
    composition: "rule of thirds",
    framing: "medium shot",
    camera: {
      shotType: "MS",
      position: "eye level",
      movement: "static",
      lensIntent: "35mm",
      depthOfField: "moderate",
    },
    characters: ["hero"],
    locations: ["studio"],
    props: [],
    products: [],
    blocking: "center",
    subjectAction: "speaks to camera",
    environmentAction: "soft practicals",
    lightingIntent: "key from left",
    temporalBeat: { startSec: i * 3, endSec: i * 3 + 3, pace: "measured" },
    startState: `start-${i}`,
    endState: `end-${i}`,
    incomingState: {
      wardrobe: ["jacket"],
      propsHeld: [],
      lighting: "key left",
      subjectPosition: "center",
      notes: [],
    },
    outgoingState: {
      wardrobe: ["jacket"],
      propsHeld: [],
      lighting: "key left",
      subjectPosition: "center",
      notes: [],
    },
    referenceRequirements: [],
    referenceAssignments: [],
    continuityRequirements: [],
    generationIntent: {
      appearanceLocked: true,
      compositionFromPanel: true,
      motionFromShotSpec: true,
      mode: "final",
    },
    rationale: ["test"],
    confidence: 0.9,
    validationIssues: [],
  };
}

function makeBlueprint(panelCount: number): StoryboardBlueprint {
  const panels = Array.from({ length: panelCount }, (_, i) =>
    makePanel(i, `shot_${String(i + 1).padStart(2, "0")}`)
  );
  const sheets =
    panelCount <= 12
      ? [
          {
            sheetId: "sheet_01",
            sheetIndex: 0,
            layout: (panelCount <= 4 ? "2x2" : panelCount <= 9 ? "3x3" : "3x4") as
              | "2x2"
              | "3x3"
              | "3x4",
            panelIds: panels.map((p) => p.panelId),
            shotIds: panels.map((p) => p.shotId),
            rangeLabel: `Shots 01–${String(panelCount).padStart(2, "0")}`,
          },
        ]
      : [
          {
            sheetId: "sheet_01",
            sheetIndex: 0,
            layout: "3x4" as const,
            panelIds: panels.slice(0, 12).map((p) => p.panelId),
            shotIds: panels.slice(0, 12).map((p) => p.shotId),
            rangeLabel: "Shots 01–12",
          },
          {
            sheetId: "sheet_02",
            sheetIndex: 1,
            layout: "2x2" as const,
            panelIds: panels.slice(12).map((p) => p.panelId),
            shotIds: panels.slice(12).map((p) => p.shotId),
            rangeLabel: `Shots 13–${String(panelCount).padStart(2, "0")}`,
          },
        ];

  return {
    id: "sb_test",
    productionId: "prod_test",
    sceneId: "scene_01",
    sequenceId: "seq_01",
    aspectRatio: "9:16",
    layout: sheets[0].layout,
    sheets,
    panels,
    panelToShotMap: Object.fromEntries(panels.map((p) => [p.panelId, p.shotId])),
    coveragePlan: "full",
    continuityState: { handoffs: [] },
    referenceManifest: {
      id: "rm_1",
      productionId: "prod_test",
      references: [],
      priorityOrder: [],
      conflicts: [],
      version: 1,
    },
    validation: { ok: true, issues: [] },
    version: 1,
    status: "approved",
    visualLock: false,
    mode: "final",
  };
}

describe("storyboard sheet vs individual frame", () => {
  it("extracts one clean frame per panel and separate sheet overview assets", () => {
    const blueprint = makeBlueprint(8);
    const { frames, sheets } = extractStoryboardFramesFromBlueprint(blueprint);

    assert.equal(frames.length, 8);
    assert.equal(sheets.length, 1);
    assert.equal(sheets[0].defaultVideoInput, false);
    assert.equal(frames[0].kind, "panel_frame");
    assert.equal(sheets[0].kind, "sheet_overview");
    assert.notEqual(frames[0].id, sheets[0].id);

    const forShot = resolveStoryboardFrameForShot({
      frames,
      shotId: "shot_03",
    });
    assert.ok(forShot);
    assert.equal(forShot!.lineage.panelId, "panel_03");
    assert.equal(forShot!.lineage.shotId, "shot_03");
    assert.equal(forShot!.excludesSheetChrome, true);
  });

  it("paginates dense sequences into multiple sheets without forcing a fixed grid", () => {
    const blueprint = makeBlueprint(16);
    const { frames, sheets } = extractStoryboardFramesFromBlueprint(blueprint);
    assert.equal(frames.length, 16);
    assert.equal(sheets.length, 2);
    assert.equal(sheets[0].panelIds.length, 12);
    assert.equal(sheets[1].panelIds.length, 4);
  });

  it("individual frame prompt forbids sheet chrome / panel numbers", () => {
    const panel = makePanel(0, "shot_01");
    const prompt = compileIndividualStoryboardFramePrompt({
      panel,
      aspectRatio: "9:16",
    });
    assert.match(prompt, /SINGLE clean/i);
    assert.match(prompt, /No panel borders/i);
    assert.doesNotMatch(prompt, /4x4 grid/i);
  });

  it("sheet overview asset is never marked as default video input", () => {
    const blueprint = makeBlueprint(4);
    const sheet = buildStoryboardSheetAsset({
      blueprint,
      sheet: blueprint.sheets![0],
      url: "https://cdn.example/sheet.jpg",
    });
    assert.equal(sheet.defaultVideoInput, false);
    assert.equal(sheet.kind, "sheet_overview");
  });
});

describe("generation frame strategy (capability-driven)", () => {
  it("uses individual storyboard frame as FIRST_FRAME when supported — never the sheet", () => {
    const frame = buildStoryboardFrameFromPanel({
      blueprint: makeBlueprint(1),
      panel: makePanel(0, "shot_01"),
      url: "https://cdn.example/panel01.jpg",
      status: "approved",
    });
    const strategy = resolveGenerationFrameStrategy({
      storyboardFrame: frame,
      preferContinuation: false,
      capabilities: {
        supportsReferenceImages: true,
        supportsStartFrame: true,
        supportsEndFrame: false,
        supportsStartAndEndFrame: false,
        supportsVideoContinuation: false,
      },
    });
    assert.equal(strategy.mode, "FIRST_FRAME");
    assert.equal(strategy.firstFrameUrl, "https://cdn.example/panel01.jpg");
    assert.equal(strategy.storyboardFrameId, frame.id);
  });

  it("falls back to REFERENCE_ONLY when first-frame conditioning is unsupported", () => {
    const frame = buildStoryboardFrameFromPanel({
      blueprint: makeBlueprint(1),
      panel: makePanel(0, "shot_01"),
      url: "https://cdn.example/panel01.jpg",
    });
    const strategy = resolveGenerationFrameStrategy({
      storyboardFrame: frame,
      preferFirstLast: true,
      storyboardEndFrame: {
        ...frame,
        id: "end",
        url: "https://cdn.example/panel01-end.jpg",
      },
      capabilities: {
        supportsReferenceImages: true,
        supportsStartFrame: false,
        supportsEndFrame: false,
        supportsStartAndEndFrame: false,
      },
    });
    assert.equal(strategy.mode, "REFERENCE_ONLY");
    assert.ok(strategy.unsupportedRequested.includes("FIRST_LAST_FRAME"));
    const fields = frameStrategyToVideoRequestFields(strategy);
    assert.equal(fields.firstFrameUrl, undefined);
    assert.ok(fields.referenceImageUrls.includes("https://cdn.example/panel01.jpg"));
  });

  it("routes continuation-dependent shots to providers that support continuation (capability-first)", () => {
    const needs = capabilityNeedsForFrameStrategy("CONTINUATION");
    assert.ok(needs.includes("video_continuation"));

    const cheapNoContinue = {
      supportsStartFrame: true,
      supportsVideoContinuation: false,
      supportsLastFrameContinuation: false,
    };
    const expensiveContinue = {
      supportsStartFrame: true,
      supportsVideoContinuation: true,
      supportsLastFrameContinuation: true,
    };

    const planned = buildStoryboardFrameFromPanel({
      blueprint: makeBlueprint(2),
      panel: makePanel(1, "shot_02"),
      url: "https://cdn.example/shot02-plan.jpg",
      status: "approved",
    });
    const prev = {
      id: "gen_last_1",
      url: "https://cdn.example/shot01-last.jpg",
      position: "LAST" as const,
      sourceVideoAssetId: "vid_1",
      sourceShotId: "shot_01",
    };

    const withCheap = resolveGenerationFrameStrategy({
      storyboardFrame: planned,
      previousGeneratedState: prev,
      preferContinuation: true,
      capabilities: cheapNoContinue,
    });
    assert.ok(
      withCheap.mode === "CONTINUATION" || withCheap.mode === "REFERENCE_PLUS_CONTINUATION"
    );
    assert.equal(withCheap.firstFrameUrl, prev.url);

    const withExpensive = resolveGenerationFrameStrategy({
      storyboardFrame: planned,
      previousGeneratedState: prev,
      preferContinuation: true,
      capabilities: expensiveContinue,
    });
    assert.equal(withExpensive.mode, "REFERENCE_PLUS_CONTINUATION");
    assert.equal(withExpensive.continuationSourceUrl, prev.url);
    assert.ok(withExpensive.referenceUrls.includes(planned.url!));
    assert.equal(withExpensive.storyboardFrameId, planned.id);
  });
});

describe("continuation: generated state + storyboard intent", () => {
  it("uses Shot A actual LAST frame for Shot B temporal continuity while preserving plan lineage", () => {
    const last = buildGeneratedStateFrame({
      productionId: "prod_test",
      sourceVideoAssetId: "vid_shot_a",
      sourceShotId: "shot_01",
      url: "https://cdn.example/shotA-last.jpg",
      position: "LAST",
      plannedStoryboardFrameId: "sbframe_shot01",
    });
    assert.equal(last.kind, "generated_state_frame");
    assert.notEqual(last.kind, "panel_frame");

    const handoff = buildContinuityFrameHandoff({
      fromShotId: "shot_01",
      toShotId: "shot_02",
      generatedLastFrame: last,
      nextStoryboardFrameId: "sbframe_shot02",
    });
    assert.equal(handoff.preferGeneratedForTemporalContinuity, true);
    assert.equal(handoff.preferStoryboardForNarrativeIntent, true);
    assert.equal(handoff.generatedLastFrame?.url, last.url);
    assert.equal(handoff.nextStoryboardFrameId, "sbframe_shot02");

    const flag = flagGeneratedStateVsPlan({
      generatedLastFrame: last,
      nextStoryboardFrameId: "sbframe_shot02",
      qcFailed: true,
    });
    assert.equal(flag.conflict, true);
    assert.ok(flag.reasons.some((r) => /QC failed/i.test(r)));
  });
});

describe("publishing policy — autonomous ≠ always publish", () => {
  it("requires approval when autonomous but publishing permission disabled", () => {
    const result = evaluatePublishGate({
      automationMode: "autonomous",
      publishingPermission: "disabled",
      finalAssetExists: true,
      finalTechnicalQcPassed: true,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    });
    assert.equal(result.action, "AWAITING_APPROVAL");
    const audit = buildPublishAuditRecord(
      {
        automationMode: "autonomous",
        publishingPermission: "disabled",
      },
      result
    );
    assert.equal(audit.decisionSource, "automation_policy");
  });

  it("publishes automatically when autonomous + publishing enabled after gates pass", () => {
    const result = evaluatePublishGate({
      automationMode: "autonomous",
      publishingPermission: "enabled",
      publishRequiresApproval: false,
      finalAssetExists: true,
      finalTechnicalQcPassed: true,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    });
    assert.equal(result.action, "PUBLISH");
  });

  it("blocks when final QC fails regardless of automation", () => {
    const result = evaluatePublishGate({
      automationMode: "autonomous",
      publishingPermission: "enabled",
      finalAssetExists: true,
      finalTechnicalQcPassed: false,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    });
    assert.equal(result.action, "BLOCKED");
  });

  it("records user approval as decisionSource=user", () => {
    const input = {
      automationMode: "manual" as const,
      userApproved: true,
      approvedBy: "director",
      finalAssetExists: true,
      finalTechnicalQcPassed: true,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    };
    const result = evaluatePublishGate(input);
    assert.equal(result.action, "PUBLISH");
    assert.equal(result.decisionSource, "user");
  });
});

describe("duration preservation contract", () => {
  it("capability needs for frame strategy do not replace duration requirements", () => {
    const needs = capabilityNeedsForFrameStrategy("FIRST_FRAME");
    assert.ok(!needs.includes("duration"));
    assert.ok(needs.includes("first_frame_conditioning") || needs.includes("image_to_video"));
  });
});


describe("profile / credentials / assets integrity", () => {
  it("scrubs provider secrets from client-bound config payloads", async () => {
    const { scrubSecrets, findForbiddenClientSecretKeys, assertNoClientSecrets } = await import(
      "./hardening/secretsBoundary"
    );
    const scrubbed = scrubSecrets({
      model: "veo",
      apiKey: "sk-secret",
      providerToken: "tok",
      publicAnonKey: "anon",
    } as Record<string, unknown>);
    assert.equal("apiKey" in scrubbed, false);
    assert.equal("providerToken" in scrubbed, false);
    assert.equal(scrubbed.model, "veo");

    const offenders = findForbiddenClientSecretKeys({
      OPENAI_API_KEY: "x",
      VITE_PUBLIC_SUPABASE_URL: "ok",
    });
    assert.ok(offenders.includes("OPENAI_API_KEY"));
    assert.ok(!offenders.includes("VITE_PUBLIC_SUPABASE_URL"));

    const clientCheck = assertNoClientSecrets({
      filePath: "src/app/components/MoreSubPages.tsx",
      exportedEnvKeys: ["OPENAI_API_KEY", "VITE_PUBLIC_APP_NAME"],
    });
    assert.equal(clientCheck.ok, false);
  });

  it("blocks hard-delete when an asset is still referenced by production lineage", async () => {
    const { assessProductionAssetDeletion, safeDeleteProductionAsset } = await import(
      "../../backend/repositories/productionAssetRepository"
    );
    const blocked = await assessProductionAssetDeletion("asset_master_1", [
      "asset_master_1",
      "asset_other",
    ]);
    assert.equal(blocked.allowed, false);
    assert.match(blocked.reason || "", /referenced/i);

    const result = await safeDeleteProductionAsset("asset_master_1", {
      referenceIds: ["asset_master_1"],
    });
    assert.equal((result as any).mode, "blocked");
  });

  it("allows hard-delete for unreferenced assets", async () => {
    const { assessProductionAssetDeletion } = await import(
      "../../backend/repositories/productionAssetRepository"
    );
    const ok = await assessProductionAssetDeletion("orphan_asset", ["master_a", "continuity_b"]);
    assert.equal(ok.allowed, true);
    assert.equal(ok.mode, "hard");
  });
});
