import test from "node:test";
import assert from "node:assert/strict";
import {
  loadGeneratorLocalAiPreference,
  saveGeneratorLocalAiPreference,
  toGeneratorExecutionOverrides,
} from "../runtime/generatorLocalAiPreference";
import { buildPreferredVideoAiPreferenceUpdate } from "../runtime/preferredVideoAiPreference";
import { getEffectiveFormatSettings } from "../../domain/types";

test("generator-local AI preference is isolated from formatSettings and aiSettings", () => {
  const brandId = "00000000-0000-4000-8000-000000000099";
  const beforeFormat = getEffectiveFormatSettings({
    formatSettings: {
      aspectMode: "portrait",
      targetDurationSec: 60,
      contentFormat: "host",
      preferredVideoProvider: "gemini",
      preferredVideoModel: "veo-3.1-generate-preview",
    },
  });

  const saved = saveGeneratorLocalAiPreference("supportingCast", brandId, {
    providerId: "openai",
    modelId: "gpt-image-1.5",
  });
  assert.equal(saved.providerId, "openai");
  assert.equal(saved.modelId, "gpt-image-1.5");

  const loaded = loadGeneratorLocalAiPreference("supportingCast", brandId);
  assert.equal(loaded.providerId, "openai");
  assert.equal(loaded.modelId, "gpt-image-1.5");

  // Character studio must not share supporting-cast preference
  const characterPref = loadGeneratorLocalAiPreference("characterStudio", brandId);
  assert.equal(characterPref.providerId, "auto");

  const overrides = toGeneratorExecutionOverrides(loaded);
  assert.equal(overrides.preferredProvider, "openai");
  assert.equal(overrides.model, "gpt-image-1.5");

  const autoOverrides = toGeneratorExecutionOverrides({ providerId: "auto" });
  assert.deepEqual(autoOverrides, {});

  // Production format / preferred video must be unchanged by generator-local saves
  const afterFormat = getEffectiveFormatSettings({
    formatSettings: {
      aspectMode: "portrait",
      targetDurationSec: 60,
      contentFormat: "host",
      preferredVideoProvider: "gemini",
      preferredVideoModel: "veo-3.1-generate-preview",
    },
  });
  assert.equal(afterFormat.preferredVideoProvider, beforeFormat.preferredVideoProvider);
  assert.equal(afterFormat.preferredVideoModel, beforeFormat.preferredVideoModel);
  assert.equal(afterFormat.preferredVideoProvider, "gemini");
});

test("clip-engine preferredVideo helper still dual-writes production format + video routing only", async () => {
  const pinned = buildPreferredVideoAiPreferenceUpdate({
    providerId: "kling",
    currentAiSettings: {
      routing: { videoGeneration: "auto", storyboardImages: "gemini" } as any,
      models: { videoGeneration: "", storyboardImages: "imagen-3" } as any,
    },
  });
  assert.equal(pinned.formatPatch.preferredVideoProvider, "kling");
  assert.ok(pinned.formatPatch.preferredVideoModel);
  assert.equal(pinned.aiSettings.routing.videoGeneration, "kling");
  // Must not overwrite storyboardImages routing (production image pipeline)
  assert.equal((pinned.aiSettings.routing as any).storyboardImages, "gemini");
  assert.equal((pinned.aiSettings.models as any).storyboardImages, "imagen-3");
});
