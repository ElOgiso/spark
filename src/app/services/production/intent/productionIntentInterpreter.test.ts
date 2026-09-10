import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  interpretProductionIntent,
  parseIntentDeterministically,
} from "./productionIntentInterpreter";
import {
  SPARK_SYSTEM_CAPABILITIES,
  listSparkCapabilities,
  getSparkCapability,
} from "../capability/sparkCapabilities";
import { advanceSeriesCanon } from "../../memory/seriesBibleService";
import type { Production, ProductionSeries, StoryCanon } from "../../../domain/types";

describe("SPARK Self-Aware Production OS — Capabilities & Intent Architecture", () => {
  describe("1. SPARK System Capability Registry", () => {
    it("declares the 12 canonical native capabilities", () => {
      const capabilities = listSparkCapabilities();
      assert.strictEqual(capabilities.length, 12);

      const ids = capabilities.map((c) => c.id);
      assert.ok(ids.includes("script_and_narrative_planning"));
      assert.ok(ids.includes("character_sheet_generation"));
      assert.ok(ids.includes("image_to_video_generation"));
      assert.ok(ids.includes("visual_continuity_and_reference_locking"));
      assert.ok(ids.includes("series_canon_and_universe_persistence"));
      assert.ok(ids.includes("multi_platform_publishing"));
    });

    it("retrieves individual capabilities with valid inputs and outputs", () => {
      const continuityCap = getSparkCapability("series_canon_and_universe_persistence");
      assert.ok(continuityCap);
      assert.strictEqual(continuityCap.category, "intelligence");
      assert.ok(continuityCap.inputRequirements.includes("series_id"));

      const videoCap = getSparkCapability("image_to_video_generation");
      assert.ok(videoCap);
      assert.strictEqual(videoCap.category, "generation");
      assert.ok(videoCap.outputArtifacts.includes("scene_video_clip_url"));
    });
  });

  describe("2. Self-Aware Intent Interpretation & Scope Isolation", () => {
    it("interprets serialized wuxia series prompt as configure_series with recurring characters", async () => {
      const prompt = "I want to make a weekly animated wuxia series about an exiled martial artist named OZ who wanders the neon ruins of Old Neo-Edo.";
      const res = await interpretProductionIntent(prompt);

      assert.strictEqual(res.intentType, "configure_series");
      assert.strictEqual(res.scope, "series");
      assert.strictEqual(res.medium, "animation");
      assert.strictEqual(res.genre, "wuxia");
      assert.strictEqual(res.cadence, "weekly");
      assert.ok(
        res.series?.recurringCharacters?.includes("OZ") ||
        res.seriesConfig?.recurringCharacters?.includes("OZ"),
        "Should detect recurring protagonist OZ"
      );
    });

    it("interprets standalone video request as create_standalone without creating a series", async () => {
      const prompt = "Make me a 30-second cinematic video of a cyber car drifting across the desert.";
      const res = await interpretProductionIntent(prompt);

      assert.strictEqual(res.intentType, "create_standalone");
      assert.strictEqual(res.scope, "episode");
      assert.strictEqual(res.cadence, "standalone");
      assert.strictEqual(res.series, undefined);
    });

    it("isolates scene directives: 'For this episode, make the palace scene at night' MUST NOT mutate creator settings", async () => {
      const prompt = "For this episode, make the palace scene at night with crimson lanterns";
      const res = await interpretProductionIntent(prompt);

      assert.strictEqual(res.intentType, "scene_directive");
      assert.notStrictEqual(res.scope, "creator", "Scene directive MUST NOT have creator scope");
      assert.ok(res.scope === "scene" || res.scope === "episode");
      assert.ok(res.sceneDirective, "Must provide sceneDirective override");
      assert.strictEqual(res.requiresConfirmation, false);
    });

    it("interprets creator-level preference as scope=creator with confirmation requirement", async () => {
      const prompt = "From now on, always use my preferred visual style with cinematic 16:9 landscape framing across all productions";
      const res = await interpretProductionIntent(prompt);

      assert.strictEqual(res.intentType, "creator_preference");
      assert.strictEqual(res.scope, "creator");
      assert.strictEqual(res.requiresConfirmation, true);
      assert.strictEqual(res.creatorPreferenceCandidate?.aspectRatio, "16:9");
    });
  });

  describe("3. Story Canon Continuity & Episode-to-Episode Evolution", () => {
    it("advances canon and carries narrative forward from Episode 1 to Episode 2", () => {
      const initialCanon: StoryCanon = {
        worldState: "Neo-Edo is divided under martial law.",
        worldRules: ["Qi manipulation requires cyber-implants"],
        establishedLocations: [{ name: "Neon Pagoda", description: "Ancient wooden pagoda flanked by holographic ads" }],
        keyProps: [{ name: "Dragon Seal", description: "Jade and titanium artifact" }],
        unresolvedPlotThreads: [],
        episodeChronology: [],
      };

      const series: ProductionSeries = {
        id: "series-oz-1",
        brandId: "brand-1",
        title: "The Wanderer OZ",
        productionType: "serialized_narrative",
        medium: "animation",
        genre: "wuxia",
        cadence: "weekly",
        currentSeason: 1,
        currentEpisode: 1,
        targetEpisodeCount: 12,
        recurringCharacters: ["OZ"],
        storyCanon: initialCanon,
        createdAt: "2026-09-10T00:00:00Z",
        updatedAt: "2026-09-10T00:00:00Z",
      };

      const completedEp1: Production = {
        id: "prod-ep-1",
        title: "Episode 1: The Broken Seal",
        sparkId: "spark-ep-1",
        seriesId: "series-oz-1",
        seasonNumber: 1,
        episodeNumber: 1,
        status: "Approved",
        mode: "standard",
        dateCreated: "2026-09-10",
        aspectRatio: "16:9",
        formats: ["YouTube Shorts"],
        videoUrl: "https://storage.googleapis.com/spark-output/ep1_final.mp4",
        brief: {
          title: "Episode 1: The Broken Seal",
          productionMode: "standard",
          hook: "OZ arrives at the ruins of Old Neo-Edo.",
          scriptOutline: "OZ fights through clan guards and uncovers the broken half of the dragon seal.",
          beats: [
            { timecode: "0:00", valueJob: "hook", spokenLines: "They said the dragon died a century ago.", onScreenText: "Old Neo-Edo" },
            { timecode: "0:15", valueJob: "payoff", spokenLines: "Who shattered the seal?", onScreenText: "To be continued..." },
          ],
        },
        productionScenes: [
          {
            scene: 1,
            duration: "0-15s",
            shotList: "Establishing shot of ruined pagoda",
            cameraDirection: "Slow push in",
            visualDescription: "OZ standing atop rain-slicked tile roof overlooking neon sprawl",
            action: "OZ leaps down into courtyard",
            physicalAction: "OZ retrieves the half-seal from the altar as storm clouds gather.",
            status: "ready",
          },
        ],
      };

      const advancedSeries = advanceSeriesCanon(series, completedEp1);

      // 1. Episode counter incremented
      assert.strictEqual(advancedSeries.currentEpisode, 2, "Episode counter should advance to 2");

      // 2. Episode 1 recorded in chronology
      const ep1Entry = advancedSeries.storyCanon.episodeChronology.find((e) => e.episodeNumber === 1);
      assert.ok(ep1Entry, "Episode 1 must be recorded in chronology");
      assert.strictEqual(ep1Entry.title, "Episode 1: The Broken Seal");
      assert.ok(ep1Entry.endingState.includes("half-seal"));

      // 3. World state updated with ending condition
      assert.ok(
        advancedSeries.storyCanon.worldState.includes("Episode 1") ||
        advancedSeries.storyCanon.worldState.includes("Ep 1"),
        "World state should record Ep 1 outcome"
      );

      // 4. Unresolved plot threads carried forward
      assert.ok(
        advancedSeries.storyCanon.unresolvedPlotThreads.length > 0,
        "Should carry forward unresolved plot hooks"
      );
      assert.ok(
        advancedSeries.storyCanon.unresolvedPlotThreads.some((thread) => thread.includes("shattered the seal")),
        "Unresolved spoken beat should become an active plot thread"
      );
    });
  });
});
