/**
 * Stage 3 — contentFormat drives compilers end-to-end.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contentFormatDirective,
  normalizeCanonicalContentFormat,
  resolveLiveBeatSubject,
  thumbnailSubjectLock,
  voiceIdentityLockBlock,
} from "./contentFormatDirectives";
import { buildStillSubjectLine, compileLiveStillPrompt } from "./compileLiveStillPrompt";
import { compileLiveMotionPrompt } from "./compileLiveMotionPrompt";
import { compileThumbnailPrompt } from "./compileThumbnailPrompt";
import { compileLiveStoryboardSheetPrompt } from "./compileLiveStoryboardSheetPrompt";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import { buildProductionSettingsSnapshot } from "./productionSettingsSnapshot";
import type { Brand } from "../../domain/types";

describe("Stage 3 contentFormat end-to-end", () => {
  it("normalizes aliases to the four canonical formats", () => {
    assert.equal(normalizeCanonicalContentFormat("slideshow"), "faceless");
    assert.equal(normalizeCanonicalContentFormat("manga"), "anime");
    assert.equal(normalizeCanonicalContentFormat("narrative"), "story");
    assert.equal(normalizeCanonicalContentFormat("presenter"), "host");
  });

  it("resolveLiveBeatSubject honors stamped main on faceless (no blanket override)", () => {
    assert.equal(
      resolveLiveBeatSubject({ contentFormat: "faceless", rawSubject: "main" }),
      "main"
    );
    assert.equal(
      resolveLiveBeatSubject({ contentFormat: "faceless", rawSubject: "" }),
      "insert"
    );
    assert.equal(
      resolveLiveBeatSubject({ contentFormat: "story", rawSubject: "support" }),
      "support"
    );
    assert.equal(
      resolveLiveBeatSubject({ contentFormat: "anime", rawSubject: "insert" }),
      "insert"
    );
  });

  it("still / motion / thumb / sheet compilers emit format laws", () => {
    const stillLine = buildStillSubjectLine({
      resolvedSubject: "main",
      contentFormat: "anime",
      character: { name: "Aiko", style: "cel-shaded" } as any,
    });
    assert.match(stillLine, /Anime lead/i);
    assert.match(stillLine, /Anime medium lock/i);

    const still = compileLiveStillPrompt({
      scene: { visualDescription: "Lead turns toward window", shotId: "s1" },
      sceneIndexZeroBased: 0,
      aspectRatio: "9:16",
      contentFormat: "faceless",
      subjectLine: buildStillSubjectLine({ resolvedSubject: "insert", contentFormat: "faceless" }),
    });
    assert.match(still.prompt, /CONTENT FORMAT: Faceless/i);

    const motion = compileLiveMotionPrompt({
      mode: "standard",
      aspectRatio: "9:16",
      sceneIndex: 1,
      totalScenes: 3,
      durationSec: 5,
      scene: { primaryChange: "camera push" },
      refLabels: ["REF 1"],
      isInsertOrSet: false,
      environment: "loft",
      contentFormat: "story",
    });
    assert.match(motion.prompt, /CONTENT FORMAT: Story/i);
    assert.match(motion.prompt, /Lead Character/i);

    const thumb = compileThumbnailPrompt({
      variantLetter: "A",
      concept: "curiosity",
      shortHookText: "STOP THIS",
      aspectRatio: "9:16",
      brandName: "Spark",
      contentFormat: "faceless",
    });
    assert.match(thumb.prompt, /NO invented host face/i);
    assert.match(thumbnailSubjectLock({ contentFormat: "anime" }), /Anime lead/i);

    const sheet = compileLiveStoryboardSheetPrompt({
      scenes: [
        { visualDescription: "Wide city", spokenLines: "Hook" },
        { visualDescription: "Close product", spokenLines: "Proof" },
      ],
      aspectRatio: "9:16",
      contentFormat: "anime",
    });
    assert.match(sheet.prompt, /CONTENT FORMAT: Anime/i);
    assert.match(sheet.prompt, /anime sequential storyboard/i);
  });

  it("voice identity lock branches by format", () => {
    assert.match(
      voiceIdentityLockBlock({ contentFormat: "faceless" }),
      /Narration-led/i
    );
    assert.match(
      voiceIdentityLockBlock({ contentFormat: "host", character: { name: "Maya" } as any }),
      /Primary subject is "Maya"/
    );
    assert.match(contentFormatDirective("story"), /multi-character narrative/i);
  });

  it("createProductionPlan stamps Spec.meta.contentFormat from snapshot (not genre)", () => {
    const brand = {
      id: "b1",
      name: "Format Brand",
      niche: "creator tools",
      contentFormat: "anime",
      formatSettings: { contentFormat: "anime", aspectMode: "portrait", targetDurationSec: 40 },
    } as Brand;
    const snapshot = buildProductionSettingsSnapshot({ brand, productionMode: "standard" });
    assert.equal(snapshot.contentFormat, "anime");

    const plan = createProductionPlan({
      idea: "A young hero trains at dawn then confronts a rival at the city gate",
      brand,
      settingsSnapshot: snapshot,
      targetDurationSec: 40,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.spec?.meta.contentFormat, "anime");
    // Asset director should treat anime as medium lock — style notes or medium anime
    const styleReq = plan.spec?.meta.assetDirector?.requirements?.find((r) => r.kind === "style");
    assert.ok(styleReq);
    assert.match(String(styleReq?.visualContract?.medium || ""), /anime/i);
  });

  it("faceless plan does not invent a required lead character master", () => {
    const brand = {
      id: "b2",
      name: "Faceless Co",
      niche: "finance tips",
      contentFormat: "faceless",
      formatSettings: { contentFormat: "faceless", aspectMode: "portrait", targetDurationSec: 30 },
    } as Brand;
    const snapshot = buildProductionSettingsSnapshot({ brand, productionMode: "standard" });
    const plan = createProductionPlan({
      idea: "Explain three budgeting mistakes with charts and B-roll of desks and phones",
      brand,
      settingsSnapshot: snapshot,
      targetDurationSec: 30,
      // Avoid Creative Director inventing host from idea keywords when format is locked
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.spec?.meta.contentFormat, "faceless");
    const charReqs = (plan.spec?.meta.assetDirector?.requirements || []).filter(
      (r) => r.kind === "character" && r.required
    );
    // Faceless may still list optional characters, but should not force a lead sheet master
    assert.ok(
      charReqs.length === 0 ||
        charReqs.every((r) => r.generationRequired === false || r.role === "extra"),
      `unexpected required character masters: ${JSON.stringify(charReqs)}`
    );
  });
});
