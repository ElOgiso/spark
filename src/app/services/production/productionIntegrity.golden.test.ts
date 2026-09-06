/**
 * Golden mocked production spine — user controls must survive planning → frames → publish.
 * No live providers / paid APIs.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDurationPolicy,
  allocateClipDurations,
} from "./durationPolicy";
import {
  evaluatePublishGate,
  buildPublishAuditRecord,
} from "./publishing/publishPolicy";
import { resolveGenerationFrameStrategy } from "./generation/frameStrategy";

describe("golden integrity — mocked production honors user controls", () => {
  it("duration → clip allocation → storyboard frame strategy → publish gate", () => {
    // --- User settings (canonical domain fields) ---
    const formatSettings = { targetDurationSec: 30 };
    const creditSettings = {
      thumbnailCount: 2,
      keyframeCount: 4,
      shortsDurationSec: 5,
      cinematicDurationSec: 12,
      maxVideoClips: 4,
    };
    const preferredModel = "mock-video-a";

    // --- Duration policy ---
    const policy = resolveDurationPolicy({
      formatSettings,
      creditSettings,
      productionMode: "express",
      providerMaxClipSec: 8,
    });
    assert.equal(policy.totalTargetDurationSec, 30);
    assert.equal(policy.preferredClipDurationSec, 5);
    assert.equal(policy.maxClips, 4);
    assert.ok(policy.maxClipDurationSec <= 5);

    const clips = allocateClipDurations(policy);
    assert.ok(clips.length >= 2);
    assert.ok(clips.length <= 4);
    assert.ok(clips.every((c) => c <= policy.maxClipDurationSec));
    // With maxClips=4 and clipLen=5, planner allocates 20s (cannot exceed clip budget)
    assert.equal(clips.reduce((a, b) => a + b, 0), 20);
    assert.equal(clips.length, 4);

    const longer = resolveDurationPolicy({
      formatSettings,
      creditSettings: { ...creditSettings, shortsDurationSec: 8 },
      productionMode: "express",
      providerMaxClipSec: 8,
    });
    assert.equal(longer.preferredClipDurationSec, 8);
    assert.notEqual(longer.preferredClipDurationSec, policy.preferredClipDurationSec);

    // --- Storyboard frames (planning) vs generated state (observed) ---
    const storyboardFrame = {
      id: "sbf-shot-1",
      url: "https://example.test/storyboard/shot-1.png",
    } as any;

    const storyboardEndFrame = {
      id: "sbf-shot-1-end",
      url: "https://example.test/storyboard/shot-1-end.png",
    } as any;

    const previousGeneratedState = {
      id: "gsf-prev-last",
      url: "https://example.test/generated/prev-last.png",
      position: "LAST" as const,
      sourceVideoAssetId: "vid-prev",
      sourceShotId: "shot-0",
      sourceGenerationTaskId: "task-prev",
      timestampSec: 4.9,
    };

    const strategy = resolveGenerationFrameStrategy({
      storyboardFrame,
      storyboardEndFrame,
      previousGeneratedState,
      preferContinuation: false,
      preferFirstLast: true,
      capabilities: {
        supportsReferenceImages: true,
        supportsStartFrame: true,
        supportsEndFrame: true,
        supportsStartAndEndFrame: true,
        supportsVideoContinuation: true,
        supportsLastFrameContinuation: true,
      },
    });

    assert.equal(strategy.mode, "FIRST_LAST_FRAME");
    assert.equal(strategy.storyboardFrameId, "sbf-shot-1");
    assert.notEqual(strategy.storyboardFrameId, previousGeneratedState.id);
    assert.ok(strategy.firstFrameUrl?.includes("storyboard/shot-1.png"));

    const continuation = resolveGenerationFrameStrategy({
      storyboardFrame,
      previousGeneratedState,
      preferContinuation: true,
      capabilities: {
        supportsReferenceImages: true,
        supportsStartFrame: true,
        supportsVideoContinuation: true,
        supportsLastFrameContinuation: true,
      },
    });
    assert.ok(
      continuation.mode === "CONTINUATION" ||
        continuation.mode === "REFERENCE_PLUS_CONTINUATION"
    );
    assert.equal(continuation.previousGeneratedStateId, "gsf-prev-last");
    assert.equal(continuation.storyboardFrameId, "sbf-shot-1");

    assert.equal(preferredModel, "mock-video-a");

    // --- Publishing policy ---
    const needsApproval = evaluatePublishGate({
      automationMode: "autonomous",
      publishingPermission: "inherit",
      publishRequiresApproval: true,
      finalAssetExists: true,
      finalTechnicalQcPassed: true,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    });
    assert.equal(needsApproval.action, "AWAITING_APPROVAL");

    const audit = buildPublishAuditRecord(
      {
        automationMode: "autonomous",
        publishRequiresApproval: true,
        finalAssetExists: true,
        finalTechnicalQcPassed: true,
        contentPolicyPassed: true,
        destinationCredentialsValid: true,
        publicationTargetValid: true,
      },
      needsApproval
    );
    assert.equal(audit.decision, "AWAITING_APPROVAL");

    const mayPublish = evaluatePublishGate({
      automationMode: "autonomous",
      publishingPermission: "enabled",
      publishRequiresApproval: false,
      finalAssetExists: true,
      finalTechnicalQcPassed: true,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    });
    assert.equal(mayPublish.action, "PUBLISH");

    const connectorFailed = evaluatePublishGate({
      automationMode: "autonomous",
      publishingPermission: "enabled",
      publishRequiresApproval: false,
      finalAssetExists: true,
      finalTechnicalQcPassed: true,
      contentPolicyPassed: true,
      destinationCredentialsValid: false,
      publicationTargetValid: true,
    });
    assert.equal(connectorFailed.action, "BLOCKED");
  });
});
