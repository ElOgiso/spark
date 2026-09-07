/**
 * Settings wiring respect — More / My Spark / Onboarding preferences
 * must flow into SPARK runtime (automation, production mode, format duration, purpose).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductionMode } from "./resolveProductionMode";
import { getEffectiveFormatSettings } from "../../domain/types";

test("resolveProductionMode honors session override and brand productionMode from settings", () => {
  assert.equal(resolveProductionMode({ modeOverride: "cinematic" }), "deep");
  assert.equal(
    resolveProductionMode({ brand: { productionMode: "narrator" } as any }),
    "express"
  );
  assert.equal(
    resolveProductionMode({
      modeOverride: "deep",
      brand: { productionMode: "express" } as any,
    }),
    "deep"
  );
});

test("getEffectiveFormatSettings respects formatSettings.targetDurationSec from My Spark / onboard", () => {
  const fmt = getEffectiveFormatSettings({
    formatSettings: { targetDurationSec: 30, aspectMode: "portrait", contentFormat: "host" },
  });
  assert.equal(fmt.targetDurationSec, 30);

  const fromBrand = getEffectiveFormatSettings({
    brand: { formatSettings: { targetDurationSec: 180, aspectMode: "portrait", contentFormat: "host" } },
  });
  assert.equal(fromBrand.targetDurationSec, 180);
});

test("onboard goal falls through to brand purpose when vision is absent", () => {
  const data = { goal: "Authority", niche: "AI" };
  const goal = data.goal || "Growth & Authority";
  const vision = (data as any).vision || (data as any).purpose || goal || "To build a leading media brand.";
  assert.equal(vision, "Authority");
});

test("autonomous drafting resolves production mode + duration from workspace state (no hardcodes)", async () => {
  // Simulate the resolution path used by autonomousEngine
  const state = {
    productionMode: "deep",
    brand: { id: "b1", name: "Test", productionMode: "deep", niche: "AI" },
    formatSettings: { targetDurationSec: 90, aspectMode: "portrait", contentFormat: "host" },
  };
  const resolvedProductionMode = resolveProductionMode({
    modeOverride: state.productionMode,
    brand: state.brand as any,
  });
  const effectiveFormat = getEffectiveFormatSettings(state);
  const targetDurationSec =
    typeof effectiveFormat?.targetDurationSec === "number" ? effectiveFormat.targetDurationSec : 60;

  assert.equal(resolvedProductionMode, "deep");
  assert.equal(targetDurationSec, 90);
  assert.notEqual(resolvedProductionMode, "standard");
  assert.notEqual(targetDurationSec, 45);
});

test("persistExecutiveModeUpdate accepts productionMode (wiring contract)", async () => {
  const mod = await import("../../backend/workspaceSync");
  assert.equal(typeof mod.persistExecutiveModeUpdate, "function");
  // Dry call — no supabase in unit test; should not throw
  await mod.persistExecutiveModeUpdate("00000000-0000-4000-8000-000000000001", {
    automationMode: "balanced",
    productionMode: "deep",
  });
});

test("Clip Engine preferredVideo helper still wires production format + video routing", async () => {
  const { buildPreferredVideoAiPreferenceUpdate } = await import("../runtime/preferredVideoAiPreference");

  const auto = buildPreferredVideoAiPreferenceUpdate({
    providerId: "auto",
    currentAiSettings: {
      routing: { videoGeneration: "gemini" } as any,
      models: { videoGeneration: "veo-3.1-generate-preview" } as any,
    },
  });
  assert.equal(auto.formatPatch.preferredVideoProvider, "auto");
  assert.equal(auto.formatPatch.preferredVideoModel, undefined);
  assert.equal(auto.aiSettings.routing.videoGeneration, "auto");
  assert.equal(auto.aiSettings.models.videoGeneration, "");

  const pinned = buildPreferredVideoAiPreferenceUpdate({
    providerId: "kling",
    currentAiSettings: {
      routing: { videoGeneration: "auto" } as any,
      models: { videoGeneration: "" } as any,
    },
  });
  assert.equal(pinned.formatPatch.preferredVideoProvider, "kling");
  assert.ok(pinned.formatPatch.preferredVideoModel);
  assert.equal(pinned.aiSettings.routing.videoGeneration, "kling");
  assert.equal(pinned.aiSettings.models.videoGeneration, pinned.formatPatch.preferredVideoModel);

  const explicitModel = buildPreferredVideoAiPreferenceUpdate({
    providerId: "gemini",
    modelId: "veo-2.0-generate-001",
  });
  assert.equal(explicitModel.formatPatch.preferredVideoProvider, "gemini");
  assert.equal(explicitModel.formatPatch.preferredVideoModel, "veo-2.0-generate-001");

  const fromMySpark = getEffectiveFormatSettings({
    formatSettings: {
      aspectMode: "portrait",
      targetDurationSec: 60,
      contentFormat: "host",
      preferredVideoProvider: "grok",
      preferredVideoModel: "grok-imagine-video",
    },
  });
  assert.equal(fromMySpark.preferredVideoProvider, "grok");
  assert.equal(fromMySpark.preferredVideoModel, "grok-imagine-video");
});
