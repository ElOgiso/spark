import test from "node:test";
import assert from "node:assert/strict";
import {
  IMAGE_AI_PROVIDER_OPTIONS,
  listImageModelsForProvider,
  loadGeneratorLocalAiPreference,
  saveGeneratorLocalAiPreference,
  toGeneratorExecutionOverrides,
} from "../runtime/generatorLocalAiPreference";
import {
  buildPreferredVideoAiPreferenceUpdate,
  listVideoModelsForProvider,
} from "../runtime/preferredVideoAiPreference";
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

test("generatorLocalAiPreference includes Higgsfield Soul and lists Soul models", () => {
  const hfOption = IMAGE_AI_PROVIDER_OPTIONS.find((opt) => opt.id === "higgsfield");
  assert.ok(hfOption, "higgsfield must exist in IMAGE_AI_PROVIDER_OPTIONS");
  assert.equal(hfOption.label, "Higgsfield Soul");

  const models = listImageModelsForProvider("higgsfield");
  assert.ok(models.length >= 2, "Must return at least soul-2 and soul-cinema");
  const soul2 = models.find((m) => m.id === "soul-2");
  const soulCinema = models.find((m) => m.id === "soul-cinema");
  assert.ok(soul2, "soul-2 must be in image models");
  assert.ok(soulCinema, "soul-cinema must be in image models");
  assert.ok(soul2.recommended, "soul-2 should be marked recommended");

  const brandId = "00000000-0000-4000-8000-000000000099";
  const saved = saveGeneratorLocalAiPreference("locationPlate", brandId, {
    providerId: "higgsfield",
    modelId: "soul-cinema",
  });
  assert.equal(saved.providerId, "higgsfield");
  assert.equal(saved.modelId, "soul-cinema");

  const loaded = loadGeneratorLocalAiPreference("locationPlate", brandId);
  assert.equal(loaded.providerId, "higgsfield");
  assert.equal(loaded.modelId, "soul-cinema");

  const overrides = toGeneratorExecutionOverrides(loaded);
  assert.equal(overrides.preferredProvider, "higgsfield");
  assert.equal(overrides.model, "soul-cinema");
});

test("preferredVideoAiPreference listVideoModelsForProvider returns Seedance models for higgsfield", () => {
  const models = listVideoModelsForProvider("higgsfield");
  assert.ok(models.length > 0, "Must return video models for higgsfield");
  const seedance25 = models.find((m) => m.id === "seedance-2.5");
  const seedance20 = models.find((m) => m.id === "seedance-2.0");
  assert.ok(seedance25, "seedance-2.5 must exist in video models");
  assert.ok(seedance20, "seedance-2.0 must exist in video models");
  assert.ok(seedance25.recommended, "seedance-2.5 should be recommended");
});

