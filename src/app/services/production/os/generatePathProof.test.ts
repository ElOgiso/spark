import test from "node:test";
import assert from "node:assert/strict";
import {
  buildScenesFromNarrativeChapters,
  chapterToClip,
  calculateSubclipDurations,
  formatChapterClipLog,
} from "./chapterToClip";
import {
  buildGrokVideoGenerateBody,
  buildVeoVideoPayload,
  snapVeoDuration,
  snapGrokDuration,
} from "../../../../../api/runtime/_videoContract";
import {
  resolveOfficialI2vClipFrames,
  looksLikeStoryboardGridUrl,
  looksLikeSheetOrGridUrl,
} from "../officialI2vFrames";
import {
  isEphemeralMediaUrl,
  isSparkStorageUrl,
  isPersistableSparkMediaUrl,
  resolveFreshPlayableUrl,
  isDurableMasterVideoReady,
} from "../productionAssetService";
import {
  resolveImmediatePlayableVideoUrl,
  resolveCanonicalMasterVideoUrl,
  resolveCanonicalProductionMedia,
} from "../canonicalProductionMedia";
import type { NarrativeScript } from "../../../domain/types";

test("SPARK — GENERATE PATH PROOF", async (t) => {
  await t.test("1. Scenes = writer chapters only: iterates chapterToClip, never allocateClipDurations or 3-scene template", () => {
    const multiChapterScript: NarrativeScript = {
      targetDurationSec: 120,
      totalDurationSec: 120,
      fullSpokenScript: "Scene one dialog. Scene two dialog. Scene three dialog. Scene four dialog.",
      chapters: [
        { index: 0, durationSec: 30, spoken: "Scene one dialog.", visualIntent: "Cinematic establishing" },
        { index: 1, durationSec: 30, spoken: "Scene two dialog.", visualIntent: "Character entrance" },
        { index: 2, durationSec: 30, spoken: "Scene three dialog.", visualIntent: "Product reveal" },
        { index: 3, durationSec: 30, spoken: "Scene four dialog.", visualIntent: "Outro resolution" },
      ],
    };

    const scenes = chapterToClip(multiChapterScript, "standard");
    assert.equal(scenes.length, 4, "Must generate exactly 4 scenes from the 4 chapters");

    // Fails loud when chapters are missing or empty — never falls back to 3-scene dummy
    const emptyScript: NarrativeScript = {
      targetDurationSec: 60,
      totalDurationSec: 0,
      fullSpokenScript: "",
      chapters: [],
    };
    assert.throws(
      () => chapterToClip(emptyScript, "standard"),
      /No writer chapters. SPARK will not invent clips./
    );

    assert.throws(
      () => chapterToClip(null as any, "standard"),
      /No writer chapters. SPARK will not invent clips./
    );
  });

  await t.test("2. Spoken on clip i is that chapter's spoken text, NEVER fullSpokenScript (unless one-chapter film)", () => {
    const fullText = "First section. Second section. Third section.";
    const script: NarrativeScript = {
      targetDurationSec: 90,
      totalDurationSec: 90,
      fullSpokenScript: fullText,
      chapters: [
        { index: 0, durationSec: 30, spoken: "First section.", visualIntent: "Visual 1" },
        { index: 1, durationSec: 30, spoken: "Second section.", visualIntent: "Visual 2" },
        { index: 2, durationSec: 30, spoken: "Third section.", visualIntent: "Visual 3" },
      ],
    };

    const scenes = chapterToClip(script, "standard");
    for (let i = 0; i < scenes.length; i++) {
      assert.equal(scenes[i].spokenLines, script.chapters[i].spoken);
      assert.notEqual(scenes[i].spokenLines, script.fullSpokenScript);
      assert.ok((scenes[i].spokenLines || "").length < script.fullSpokenScript.length);
    }

    // Log contains chapterIndex, chapterDur, maxNativeSec, subclipCount, spokenChars, fullScriptLength
    const logOutput = formatChapterClipLog({
      chapterIndex: 1,
      chapterDur: 30,
      maxNativeSec: 15,
      subclipCount: 2,
      spokenChars: scenes[0].spokenLines!.length,
      fullScriptLength: script.fullSpokenScript.length,
    });
    assert.ok(logOutput.includes("chapterDur=30s"));
    assert.ok(logOutput.includes("maxNativeSec=15s"));
    assert.ok(logOutput.includes("subclipCount=2"));
    assert.ok(logOutput.includes(`spokenChars=${scenes[0].spokenLines!.length}`));
    assert.ok(logOutput.includes(`fullScriptLength=${script.fullSpokenScript.length}`));
  });

  await t.test("3. Split ONLY when chapter.durationSec > engine maxNativeSec", () => {
    // 30s chapter on Grok (15s max) -> 2 subclips
    const grokSubclips = calculateSubclipDurations(30, 15);
    assert.deepEqual(grokSubclips, [15, 15]);

    // 12s chapter on Grok (15s max) -> 1 subclip
    const singleSubclip = calculateSubclipDurations(12, 15);
    assert.deepEqual(singleSubclip, [12]);

    // 30s chapter on Veo (8s max, allowed 4|6|8) -> [8, 8, 8, 6]
    const veoSubclips = calculateSubclipDurations(30, 8, [4, 6, 8]);
    assert.deepEqual(veoSubclips, [8, 8, 8, 6]);
    assert.equal(veoSubclips.reduce((a, b) => a + b, 0), 30);
  });

  await t.test("4. Still required before motion: fails shot if still is missing or invalid", () => {
    // Empty still throws
    assert.throws(
      () =>
        resolveOfficialI2vClipFrames({
          sceneImage: "",
          keyframeUrl: undefined,
          generatedFrameUrl: undefined,
        }),
      /I2V requires this shot's still as frame 1/
    );

    // Grok contract throws if stillUrl is empty
    assert.throws(
      () =>
        buildGrokVideoGenerateBody({
          prompt: "Cinematic camera movement",
          firstFrameUrl: "",
        }),
      /Still required before motion. Grok I2V requires this shot's still as frame 1/
    );
  });

  await t.test("5. First frame is scene still, NEVER storyboard grid or character sheet", () => {
    const gridUrl = "https://spark.storage/brands/b1/storyboard-grid.png";
    const sheetUrl = "https://spark.storage/brands/b1/characters/hero-character-sheet.png";
    const validStill = "https://spark.storage/brands/b1/p1/scenes/scene-01-still.png";

    assert.equal(looksLikeStoryboardGridUrl(gridUrl), true);
    assert.equal(looksLikeSheetOrGridUrl(gridUrl), true);
    assert.equal(looksLikeSheetOrGridUrl(sheetUrl), true);
    assert.equal(looksLikeStoryboardGridUrl(validStill), false);
    assert.equal(looksLikeSheetOrGridUrl(validStill), false);

    assert.throws(
      () =>
        buildGrokVideoGenerateBody({
          prompt: "Cinematic movement",
          firstFrameUrl: gridUrl,
        }),
      /Storyboard grids or sheet URLs cannot be used as the I2V first frame/
    );

    assert.throws(
      () =>
        buildGrokVideoGenerateBody({
          prompt: "Cinematic movement",
          firstFrameUrl: sheetUrl,
        }),
      /Storyboard grids or sheet URLs cannot be used as the I2V first frame/
    );

    // Valid still passes and becomes image.url
    const validBody = buildGrokVideoGenerateBody({
      prompt: "Cinematic movement",
      firstFrameUrl: validStill,
      durationSec: 5,
    });
    assert.deepEqual(validBody.image, { url: validStill });
  });

  await t.test("6. Ingest provider clips immediately; isEphemeralMediaUrl does not blank Review; Review hero plays durable master", async () => {
    const providerClip = "https://vidgen.x.ai/shot-01-out.mp4";
    const sparkMaster = "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/master.mp4";

    assert.equal(isEphemeralMediaUrl(providerClip), true);
    assert.equal(isDurableMasterVideoReady(providerClip), false);
    assert.equal(isDurableMasterVideoReady(sparkMaster), true);

    // resolveFreshPlayableUrl retains provider URL in flight
    const fresh = await resolveFreshPlayableUrl({
      url: providerClip,
      storagePath: null,
      productionId: "p-test",
      brandId: "b-test",
      assetType: "video",
    });
    assert.equal(fresh.url, providerClip, "Must keep provider URL so player does not blank");

    // Review media resolution prefers durable master for the hero player
    const productionWithMaster: any = {
      id: "p-test",
      videoUrl: sparkMaster,
      canonicalMasterUrl: sparkMaster,
      productionScenes: [
        { scene: 1, image: "https://spark.storage/s1.png", videoUrl: providerClip },
        { scene: 2, image: "https://spark.storage/s2.png", videoUrl: "https://vidgen.x.ai/shot-02-out.mp4" },
      ],
    };

    const media = resolveCanonicalProductionMedia({ production: productionWithMaster });
    assert.equal(media.hasCanonicalMaster, true);
    assert.equal(media.canonicalMasterUrl, sparkMaster);
    assert.equal(media.canonicalMasterRole, "canonical_master");
  });
});
