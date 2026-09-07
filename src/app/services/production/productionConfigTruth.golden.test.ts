/**
 * Production configuration → asset truth golden tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachProductionSettingsSnapshot,
  buildProductionSettingsSnapshot,
  resolveGenerationSettings,
  readProductionSettingsSnapshot,
  isCinematicMode,
  isNarratorMode,
} from "./productionSettingsSnapshot";
import {
  resolveCanonicalProductionMedia,
  resolveReviewHeroVideoUrl,
  hasCanonicalPlayableMedia,
} from "./canonicalProductionMedia";
import type { Brand, Character, MemoryItem, Production, ViralSpark } from "../../domain/types";

const durable = (name: string) =>
  `https://example.supabase.co/storage/v1/object/public/Spark/prod-1/${name}`;

function baseBrand(): Brand {
  return {
    name: "Crypto VIRAL SHORTS",
    niche: "crypto education",
    archetype: "Viral Educator",
    purpose: "Turn complex crypto into clear short stories",
    country: "US",
    language: "en",
    contentPillars: [],
    audience: {
      primary: "General Audience",
      painPoints: ["confusion", "noise"],
      desires: ["clarity", "confidence"],
    },
    tone: [{ label: "Urgent", active: true }],
    style: [{ label: "Cinematic Host", active: true }],
    automation_mode: "balanced",
    formatSettings: {
      aspectMode: "portrait",
      targetDurationSec: 15,
      contentFormat: "story",
      preferredVideoProvider: "gemini",
      preferredVideoModel: "veo",
    },
    creditSettings: {
      thumbnailCount: 3,
      keyframeCount: 3,
      shortsDurationSec: 8,
      cinematicDurationSec: 8,
      maxVideoClips: 3,
    },
  };
}

function baseCharacter(): Character {
  return {
    name: "Lead Host",
    role: "Host",
    style: "Executive Presenter",
    traits: ["clear", "confident"],
    characterSheetUrl: durable("character-sheet.png"),
    voice: {
      name: "Roger",
      language: "en",
      tone: "authoritative",
      locked: true,
      voiceId: "roger-voice-id",
    },
  };
}

function baseSpark(): ViralSpark {
  return {
    id: "spark-1",
    title: "Rainlit Village Hook",
    hook: "What if the village already knew?",
    views: "1.2M",
    velocity: "high",
    platformFit: "YouTube Shorts",
    brandFitScore: 92,
    category: "hot",
    timeWindow: "24h",
    productionTime: "15m",
    whyNow: "Trend spike",
    angle: "Story reveal",
    audienceEmotion: "curiosity",
    expectedRetention: "high",
    difficulty: "medium",
    riskLevel: "Low",
    suggestedFormat: "story",
    suggestedProductionMode: "cinematic",
    suggestedMode: "deep",
    researchContext: {
      sourceName: "RainlitVillage",
      platform: "YouTube",
      hookPattern: "mystery open",
      titlePattern: "reveal",
      format: "story",
    },
  };
}

describe("production settings snapshot", () => {
  it("captures Spark configuration immutably at production creation", () => {
    const brand = baseBrand();
    const character = baseCharacter();
    const spark = baseSpark();
    const memoryItems: MemoryItem[] = [
      { id: "m1", type: "rule", text: "Keep host framing consistent", dateAdded: "2026-01-01" },
      { id: "m2", type: "rule", text: "Keep host framing consistent", dateAdded: "2026-01-02" },
    ];
    const snapshot = buildProductionSettingsSnapshot({
      brand,
      spark,
      character,
      memoryItems,
      productionMode: "cinematic",
      automationMode: "balanced",
    });

    assert.equal(snapshot.contentFormat, "story");
    assert.equal(snapshot.productionMode, "deep");
    assert.equal(isCinematicMode(snapshot.productionMode), true);
    assert.equal(snapshot.content.targetDurationSec, 15);
    assert.equal(snapshot.content.aspectMode, "portrait");
    assert.equal(snapshot.video.preferredVideoProvider, "gemini");
    assert.equal(snapshot.video.preferredVideoModel, "veo");
    assert.equal(snapshot.character.primaryCharacterName, "Lead Host");
    assert.equal(snapshot.character.hasLockedCharacterSheet, true);
    assert.equal(snapshot.voice.voiceName, "Roger");
    assert.equal(snapshot.voice.voiceId, "roger-voice-id");
    assert.equal(snapshot.creative.activeContentPillarCount, 0);
    assert.equal(snapshot.intelligence.researchContextPresent, true);
    assert.equal(snapshot.intelligence.memoryRuleCount, 1);

    const production = attachProductionSettingsSnapshot(
      {
        id: "prod-1",
        title: "Test",
        status: "Ready for Review",
        mode: "standard",
        dateCreated: "2026-09-06",
        aspectRatio: "9:16",
        formats: ["YouTube Shorts"],
        scenes: [],
      } as Production,
      snapshot,
    );

    const readBack = readProductionSettingsSnapshot(production, production.brief);
    assert.ok(readBack);
    assert.equal(readBack!.video.preferredVideoModel, "veo");
    assert.equal(readBack!.productionMode, "deep");

    brand.formatSettings = {
      ...brand.formatSettings!,
      preferredVideoModel: "other-model",
      contentFormat: "faceless",
      targetDurationSec: 60,
    };
    const resolved = resolveGenerationSettings({
      production,
      brief: production.brief,
      brand,
    });
    assert.equal(resolved.source, "snapshot");
    assert.equal(resolved.preferredVideoModel, "veo");
    assert.equal(resolved.formatSettings.contentFormat, "story");
    assert.equal(resolved.formatSettings.targetDurationSec, 15);
    assert.equal(resolved.productionMode, "deep");
  });

  it("keeps cinematic snapshot authoritative when live brand prefers narrator", () => {
    const brand = baseBrand();
    (brand as any).productionMode = "narrator";
    const snapshot = buildProductionSettingsSnapshot({
      brand,
      spark: baseSpark(),
      character: baseCharacter(),
      productionMode: "cinematic",
      automationMode: "balanced",
    });
    assert.equal(snapshot.productionMode, "deep");
    assert.equal(isCinematicMode(snapshot.productionMode), true);

    const production = attachProductionSettingsSnapshot(
      {
        id: "prod-mode-lock",
        title: "Mode Lock",
        status: "Ready for Review",
        mode: "express",
        dateCreated: "2026-09-06",
        aspectRatio: "9:16",
        formats: ["YouTube Shorts"],
        scenes: [],
      } as Production,
      snapshot,
    );

    const resolved = resolveGenerationSettings({
      production,
      brief: production.brief,
      brand,
    });
    assert.equal(resolved.source, "snapshot");
    assert.equal(resolved.productionMode, "deep");
    assert.equal(resolved.preferredVideoProvider, "gemini");
    assert.equal(resolved.preferredVideoModel, "veo");
  });
});

describe("canonical media spine", () => {
  it("does not show scene clips as Review master when master is missing", () => {
    const scene1 = durable("scenes/scene-01.mp4");
    const scene2 = durable("scenes/scene-02.mp4");
    const scene3 = durable("scenes/scene-03.mp4");
    const production: any = {
      id: "prod-missing-master",
      mode: "deep",
      productionMode: "cinematic",
      videoUrl: scene1,
      formatSettings: {
        contentFormat: "story",
        aspectMode: "portrait",
        targetDurationSec: 15,
      },
      scenes: [
        { scene: 1, description: "Hook", duration: "0-5s", videoUrl: scene1 },
        { scene: 2, description: "Turn", duration: "5-10s", videoUrl: scene2 },
        { scene: 3, description: "Payoff", duration: "10-15s", videoUrl: scene3 },
      ],
      brief: {
        productionMode: "deep",
        formatSettings: {
          contentFormat: "story",
          aspectMode: "portrait",
          targetDurationSec: 15,
        },
        storyboard: [
          { scene: 1, videoUrl: scene1, visualDescription: "Hook" },
          { scene: 2, videoUrl: scene2, visualDescription: "Turn" },
          { scene: 3, videoUrl: scene3, visualDescription: "Payoff" },
        ],
        generatedAssets: { generatedVideos: [scene1, scene2, scene3] },
        videoUrl: scene1,
      },
    };
    production.settingsSnapshot = buildProductionSettingsSnapshot({
      brand: baseBrand(),
      spark: baseSpark(),
      character: baseCharacter(),
      productionMode: "cinematic",
    });

    const media = resolveCanonicalProductionMedia({
      production,
      review: { videoUrl: scene1 },
      brief: production.brief,
    });

    assert.equal(media.sceneClips.length, 3);
    assert.equal(media.hasCanonicalMaster, false);
    assert.equal(media.canonicalMasterUrl, undefined);
    assert.ok(media.masterUnavailableReason);
    assert.equal(resolveReviewHeroVideoUrl({ production, brief: production.brief }), undefined);
  });

  it("Review and Assets resolve the same canonical master when present", () => {
    const scene1 = durable("scenes/scene-01.mp4");
    const scene2 = durable("scenes/scene-02.mp4");
    const scene3 = durable("scenes/scene-03.mp4");
    const master = durable("video/master.mp4");
    const production: any = {
      id: "prod-with-master",
      mode: "deep",
      productionMode: "cinematic",
      videoUrl: master,
      canonicalMasterUrl: master,
      scenes: [
        { scene: 1, description: "Hook", duration: "0-5s", videoUrl: scene1 },
        { scene: 2, description: "Turn", duration: "5-10s", videoUrl: scene2 },
        { scene: 3, description: "Payoff", duration: "10-15s", videoUrl: scene3 },
      ],
      brief: {
        productionMode: "deep",
        videoUrl: master,
        canonicalMasterUrl: master,
        storyboard: [
          { scene: 1, videoUrl: scene1 },
          { scene: 2, videoUrl: scene2 },
          { scene: 3, videoUrl: scene3 },
        ],
        generatedAssets: {
          generatedVideos: [scene1, scene2, scene3],
          canonicalMasterUrl: master,
        },
      },
    };

    const media = resolveCanonicalProductionMedia({ production, brief: production.brief });
    assert.equal(media.sceneClips.length, 3);
    assert.equal(media.hasCanonicalMaster, true);
    assert.equal(media.canonicalMasterUrl, master);
    assert.equal(resolveReviewHeroVideoUrl({ production, brief: production.brief }), master);
  });

  it("quarantines narrator slideshow fallback for cinematic productions", () => {
    const fallback = durable("video/master-fallback.mp4");
    const production: any = {
      id: "prod-fallback",
      mode: "deep",
      productionMode: "cinematic",
      videoUrl: fallback,
      brief: {
        productionMode: "deep",
        videoUrl: fallback,
        generatedAssets: { emergencyFallbackVideoUrl: fallback },
      },
    };
    production.settingsSnapshot = buildProductionSettingsSnapshot({
      brand: baseBrand(),
      productionMode: "cinematic",
    });

    const media = resolveCanonicalProductionMedia({ production, brief: production.brief });
    assert.equal(isCinematicMode(media.productionMode), true);
    assert.equal(media.canonicalMasterUrl, undefined);
    assert.equal(media.emergencyFallbackUrl, fallback);
    assert.equal(media.modeMismatch, true);
    assert.equal(isNarratorMode("express"), true);
  });

  it("allows slideshow master for narrator/express mode", () => {
    const fallback = durable("video/master-fallback.mp4");
    const production: any = {
      id: "prod-narrator",
      mode: "express",
      productionMode: "narrator",
      videoUrl: fallback,
      brief: { productionMode: "express", videoUrl: fallback },
    };
    const media = resolveCanonicalProductionMedia({ production, brief: production.brief });
    assert.equal(media.canonicalMasterUrl, fallback);
  });

  it("hasCanonicalPlayableMedia is true for scene clips or master, false for cinematic fallback-only", () => {
    const scene1 = durable("scenes/scene-01.mp4");
    const clipsOnly: any = {
      id: "prod-clips",
      mode: "deep",
      productionMode: "cinematic",
      brief: {
        storyboard: [{ scene: 1, videoUrl: scene1 }],
        generatedAssets: { generatedVideos: [scene1] },
      },
    };
    clipsOnly.settingsSnapshot = buildProductionSettingsSnapshot({
      brand: baseBrand(),
      productionMode: "cinematic",
    });
    assert.equal(hasCanonicalPlayableMedia({ production: clipsOnly, brief: clipsOnly.brief }), true);

    const fallback = durable("video/master-fallback.mp4");
    const fallbackOnly: any = {
      id: "prod-fallback",
      mode: "deep",
      productionMode: "cinematic",
      videoUrl: fallback,
      brief: { videoUrl: fallback, generatedAssets: { emergencyFallbackVideoUrl: fallback } },
    };
    fallbackOnly.settingsSnapshot = buildProductionSettingsSnapshot({
      brand: baseBrand(),
      productionMode: "cinematic",
    });
    assert.equal(hasCanonicalPlayableMedia({ production: fallbackOnly, brief: fallbackOnly.brief }), false);
  });
});
