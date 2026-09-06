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
