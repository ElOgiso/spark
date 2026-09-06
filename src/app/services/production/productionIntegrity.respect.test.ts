/**
 * Production integrity repairs — controls must change production behavior.
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
import {
  scrubSecrets,
  findForbiddenClientSecretKeys,
} from "./hardening/secretsBoundary";

describe("duration policy — user controls must change planning", () => {
  it("uses formatSettings.targetDurationSec as total production length", () => {
    const policy = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 30 },
      creditSettings: {
        thumbnailCount: 3,
        keyframeCount: 6,
        shortsDurationSec: 8,
        cinematicDurationSec: 12,
        maxVideoClips: 6,
      },
      productionMode: "shorts",
      providerMaxClipSec: 8,
    });
    assert.equal(policy.totalTargetDurationSec, 30);
    assert.equal(policy.source.totalFrom, "formatSettings.targetDurationSec");
    assert.equal(policy.preferredClipDurationSec, 8);
    assert.equal(policy.mode, "shorts");
  });

  it("honors shortsDurationSec as preferred clip length (not panel count)", () => {
    const shortClip = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 60 },
      creditSettings: {
        thumbnailCount: 1,
        keyframeCount: 10,
        shortsDurationSec: 5,
        cinematicDurationSec: 12,
        maxVideoClips: 10,
      },
      productionMode: "express",
      providerMaxClipSec: 15,
    });
    assert.equal(shortClip.preferredClipDurationSec, 5);
    assert.equal(shortClip.maxClipDurationSec, 5);

    const longClip = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 60 },
      creditSettings: {
        thumbnailCount: 1,
        keyframeCount: 10,
        shortsDurationSec: 15,
        cinematicDurationSec: 12,
        maxVideoClips: 10,
      },
      productionMode: "express",
      providerMaxClipSec: 15,
    });
    assert.equal(longClip.preferredClipDurationSec, 15);
  });

  it("honors cinematicDurationSec in cinematic/deep mode", () => {
    const policy = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 180 },
      creditSettings: {
        thumbnailCount: 2,
        keyframeCount: 8,
        shortsDurationSec: 8,
        cinematicDurationSec: 12,
        maxVideoClips: 8,
      },
      productionMode: "cinematic",
      providerMaxClipSec: 12,
    });
    assert.equal(policy.mode, "cinematic");
    assert.equal(policy.preferredClipDurationSec, 12);
    assert.equal(policy.maxClipDurationSec, 12);
  });

  it("decomposes when preferred clip exceeds provider max — does not silently truncate story", () => {
    const policy = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 30 },
      creditSettings: {
        thumbnailCount: 1,
        keyframeCount: 10,
        shortsDurationSec: 15,
        cinematicDurationSec: 20,
        maxVideoClips: 10,
      },
      productionMode: "shorts",
      providerMaxClipSec: 8,
    });
    assert.equal(policy.maxClipDurationSec, 8);
    assert.ok(policy.rationale.some((r) => /exceeds provider max/i.test(r)));
    const clips = allocateClipDurations(policy);
    const sum = clips.reduce((a, b) => a + b, 0);
    assert.ok(sum >= 24);
    assert.ok(clips.every((c) => c <= 8));
    assert.ok(clips.length >= 2);
  });

  it("enforces maxVideoClips / keyframeCount as clip budget, not duration", () => {
    const policy = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 120 },
      creditSettings: {
        thumbnailCount: 1,
        keyframeCount: 3,
        shortsDurationSec: 8,
        cinematicDurationSec: 12,
        maxVideoClips: 3,
      },
      productionMode: "standard",
      providerMaxClipSec: 8,
    });
    assert.equal(policy.maxClips, 3);
    assert.equal(policy.maxPanels, 3);
    assert.equal(policy.source.clipCapFrom, "maxVideoClips");
    const clips = allocateClipDurations(policy);
    assert.ok(clips.length <= 3);
  });

  it("changing total target duration changes allocation", () => {
    const a = allocateClipDurations(
      resolveDurationPolicy({
        formatSettings: { targetDurationSec: 15 },
        creditSettings: {
          thumbnailCount: 1,
          keyframeCount: 10,
          shortsDurationSec: 5,
          cinematicDurationSec: 12,
          maxVideoClips: 10,
        },
        productionMode: "shorts",
        providerMaxClipSec: 8,
      })
    );
    const b = allocateClipDurations(
      resolveDurationPolicy({
        formatSettings: { targetDurationSec: 60 },
        creditSettings: {
          thumbnailCount: 1,
          keyframeCount: 10,
          shortsDurationSec: 5,
          cinematicDurationSec: 12,
          maxVideoClips: 10,
        },
        productionMode: "shorts",
        providerMaxClipSec: 8,
      })
    );
    assert.notEqual(a.length, b.length);
    assert.ok(b.reduce((x, y) => x + y, 0) > a.reduce((x, y) => x + y, 0));
  });
});

describe("publishing integrity — no fake success", () => {
  it("autonomous + publishing disabled still requires approval", () => {
    const result = evaluatePublishGate({
      automationMode: "autonomous",
      publishingPermission: "disabled",
      publishRequiresApproval: true,
      finalAssetExists: true,
      finalTechnicalQcPassed: true,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    });
    assert.equal(result.action, "AWAITING_APPROVAL");
  });

  it("manual mode never auto-publishes", () => {
    const result = evaluatePublishGate({
      automationMode: "manual",
      publishingPermission: "enabled",
      finalAssetExists: true,
      finalTechnicalQcPassed: true,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    });
    assert.equal(result.action, "AWAITING_APPROVAL");
  });

  it("autonomous + publishing enabled may publish after gates", () => {
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
    assert.equal(result.decisionSource, "automation_policy");
  });

  it("audit distinguishes user vs automation_policy", () => {
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
    const audit = buildPublishAuditRecord(input, result);
    assert.equal(result.decisionSource, "user");
    assert.equal(audit.decisionSource, "user");
  });

  it("failed gates block regardless of automation", () => {
    const result = evaluatePublishGate({
      automationMode: "autonomous",
      publishingPermission: "enabled",
      publishRequiresApproval: false,
      finalAssetExists: true,
      finalTechnicalQcPassed: false,
      contentPolicyPassed: true,
      destinationCredentialsValid: true,
      publicationTargetValid: true,
    });
    assert.equal(result.action, "BLOCKED");
  });
});

describe("credential secrecy", () => {
  it("scrubs secrets from client-bound payloads", () => {
    const scrubbed = scrubSecrets({
      model: "veo",
      apiKey: "sk-secret",
      providerToken: "tok",
    } as Record<string, unknown>);
    assert.equal("apiKey" in scrubbed, false);
    assert.equal("providerToken" in scrubbed, false);
    assert.equal(scrubbed.model, "veo");
    const offenders = findForbiddenClientSecretKeys({
      OPENAI_API_KEY: "x",
      VITE_PUBLIC_SUPABASE_URL: "ok",
    });
    assert.ok(offenders.includes("OPENAI_API_KEY"));
  });
});
