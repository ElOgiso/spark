import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildScenesFromNarrativeChapters,
  calculateSubclipDurations,
  resolveMaxNativeClipSec,
  resolveAllowedDurationsSec,
} from "./chapterToClip";
import type { NarrativeScript } from "../../../domain/types";

describe("SPARK — CHAPTER -> CLIP", () => {
  it("300s executive movie with 10 chapters of 30s each on Grok (maxNative 15) yields 2 subclips per chapter = 20 clips total", () => {
    const chapters = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      title: `Chapter ${i + 1}`,
      durationSec: 30,
      job: "problem" as const,
      visualIntent: `Visual scene ${i + 1}`,
      spoken: `Spoken dialogue for scene ${i + 1}.`,
    }));

    const script: NarrativeScript = {
      targetDurationSec: 300,
      totalDurationSec: 300,
      fullSpokenScript: chapters.map((c) => c.spoken).join(" "),
      chapters,
    };

    const scenes = buildScenesFromNarrativeChapters(script, "standard");
    assert.equal(scenes.length, 10);

    let totalSubclips = 0;
    for (let i = 0; i < scenes.length; i++) {
      const subclipDurations = calculateSubclipDurations(scenes[i].durationSec, 15);
      assert.deepEqual(subclipDurations, [15, 15]);
      assert.equal(subclipDurations.length, 2);
      totalSubclips += subclipDurations.length;
    }

    assert.equal(totalSubclips, 20);
  });

  it("30s chapter with Veo (maxNative 8, allowed [4, 6, 8]) yields 4 subclips [8, 8, 8, 6]", () => {
    const subclips = calculateSubclipDurations(30, 8, [4, 6, 8]);
    assert.deepEqual(subclips, [8, 8, 8, 6]);
    assert.equal(subclips.reduce((a, b) => a + b, 0), 30);
  });

  it("chapter duration <= maxNativeSec results in exactly 1 clip without splitting", () => {
    const subclips = calculateSubclipDurations(8, 8, [4, 6, 8]);
    assert.deepEqual(subclips, [8]);

    const grokSubclips = calculateSubclipDurations(12, 15);
    assert.deepEqual(grokSubclips, [12]);
  });

  it("11s chapter + maxNativeSec 30 (Higgsfield Seedance 2.5) yields exactly 1 subclip [11]", () => {
    const maxNativeSec = resolveMaxNativeClipSec("higgsfield", "seedance-2.5-i2v");
    const allowed = resolveAllowedDurationsSec("higgsfield", "seedance-2.5-i2v");
    assert.equal(maxNativeSec, 30);
    assert.equal(allowed.length, 27); // 4..30
    const subclips = calculateSubclipDurations(11, maxNativeSec, allowed);
    assert.deepEqual(subclips, [11]);
    assert.equal(subclips.length, 1);
  });

  it("11s chapter + maxNativeSec 8 (e.g. Veo) yields 2 subclips", () => {
    const maxNativeSec = resolveMaxNativeClipSec("gemini");
    const allowed = resolveAllowedDurationsSec("gemini");
    assert.equal(maxNativeSec, 8);
    assert.deepEqual(allowed, [4, 6, 8]);
    const subclips = calculateSubclipDurations(11, maxNativeSec, allowed);
    assert.equal(subclips.length, 2);
    assert.equal(subclips.reduce((a, b) => a + b, 0), 11);
  });

  it("resolves accurate maxNativeSec and allowed durations per provider/model", () => {
    assert.equal(resolveMaxNativeClipSec("higgsfield", "seedance-2.5-i2v"), 30);
    assert.equal(resolveMaxNativeClipSec("higgsfield", "seedance-2.0-i2v"), 15);
    assert.equal(resolveMaxNativeClipSec("grok"), 15);
    assert.equal(resolveMaxNativeClipSec("seedance"), 15);
    assert.equal(resolveMaxNativeClipSec("kling"), 10);
    assert.equal(resolveMaxNativeClipSec("runway"), 10);
    assert.equal(resolveMaxNativeClipSec("luma"), 9);
    assert.equal(resolveMaxNativeClipSec("gemini"), 8);
  });

  it("throws loud if narrativeScript.chapters is empty", () => {
    const emptyScript: NarrativeScript = {
      targetDurationSec: 60,
      totalDurationSec: 0,
      fullSpokenScript: "",
      chapters: [],
    };

    assert.throws(
      () => buildScenesFromNarrativeChapters(emptyScript, "standard"),
      /No writer chapters. SPARK will not invent clips./
    );
  });

  it("throws loud if any chapter is missing durationSec", () => {
    const invalidScript: any = {
      targetDurationSec: 60,
      totalDurationSec: 60,
      chapters: [
        { index: 0, spoken: "Hello", durationSec: 10 },
        { index: 1, spoken: "World" },
      ],
    };

    assert.throws(
      () => buildScenesFromNarrativeChapters(invalidScript, "standard"),
      /Chapter 2 missing required durationSec/
    );
  });

  it("scene spoken lines equal THAT chapter's spoken text, never the entire fullSpokenScript", () => {
    const script: NarrativeScript = {
      targetDurationSec: 60,
      totalDurationSec: 60,
      fullSpokenScript: "Chapter one text. Chapter two text. Chapter three text.",
      chapters: [
        { index: 0, durationSec: 20, spoken: "Chapter one text.", visualIntent: "V1" },
        { index: 1, durationSec: 20, spoken: "Chapter two text.", visualIntent: "V2" },
        { index: 2, durationSec: 20, spoken: "Chapter three text.", visualIntent: "V3" },
      ],
    };

    const scenes = buildScenesFromNarrativeChapters(script, "standard");
    assert.equal(scenes[0].spokenLines, "Chapter one text.");
    assert.notEqual(scenes[0].spokenLines, script.fullSpokenScript);

    assert.equal(scenes[1].spokenLines, "Chapter two text.");
    assert.notEqual(scenes[1].spokenLines, script.fullSpokenScript);

    assert.equal(scenes[2].spokenLines, "Chapter three text.");
    assert.notEqual(scenes[2].spokenLines, script.fullSpokenScript);
  });

  it("respects mode gates for audio routing (narrator -> vo, cinematic -> talent)", () => {
    const script: NarrativeScript = {
      targetDurationSec: 20,
      totalDurationSec: 20,
      fullSpokenScript: "Dialogue line",
      chapters: [
        { index: 0, durationSec: 20, spoken: "Dialogue line", visualIntent: "Close up" },
      ],
    };

    const narratorScenes = buildScenesFromNarrativeChapters(script, "narrator");
    assert.equal(narratorScenes[0].audio, "vo");

    const cinematicScenes = buildScenesFromNarrativeChapters(script, "cinematic");
    assert.equal(cinematicScenes[0].audio, "talent");
  });
});
