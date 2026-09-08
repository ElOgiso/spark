import assert from "node:assert/strict";
import test from "node:test";
import {
  inferVisualGenreFromText,
  resolveVisualGenre,
  defaultVisualGenreForContentFormat,
  visualGenreSkillTags,
  isPhotorealVisualGenre,
} from "../../domain/visualGenre";
import { compileLiveStillPrompt, panelSpecFromLiveScene, buildStillSubjectLine } from "./compileLiveStillPrompt";
import { compileLiveMotionPrompt } from "./compileLiveMotionPrompt";
import { compileLiveStoryboardSheetPrompt } from "./compileLiveStoryboardSheetPrompt";
import { visualGenreDirective } from "./visualGenreDirectives";
import { attachSceneMotionLock } from "./sceneMotionLock";
import { ensureFilmmakingSkillLibrary, resetFilmmakingSkillLibraryForTests, getSkill } from "./knowledge";
import { getEffectiveFormatSettings } from "../../domain/types";

test("inferVisualGenreFromText maps wuxia / anime / pixar / documentary", () => {
  assert.equal(inferVisualGenreFromText("xianxia cultivation sect on a floating mountain"), "donghua_wuxia");
  assert.equal(inferVisualGenreFromText("shonen anime tournament"), "anime");
  assert.equal(inferVisualGenreFromText("Pixar-style animated feature about a family"), "cartoon_3d");
  assert.equal(inferVisualGenreFromText("observational documentary archive footage"), "documentary");
  assert.equal(inferVisualGenreFromText("Renegade Immortal floating peak duel"), "donghua_wuxia");
  assert.equal(inferVisualGenreFromText("Tokyo Ghoul rain alley"), "anime");
  assert.equal(inferVisualGenreFromText("Ne Zha mythological CGI feature"), "cartoon_3d");
});

test("resolveVisualGenre honors explicit pick over idea inference", () => {
  const genre = resolveVisualGenre({
    explicit: "donghua_wuxia",
    contentFormat: "host",
    ideaText: "generic productivity tips in a studio",
  });
  assert.equal(genre, "donghua_wuxia");
});

test("auto + anime format defaults to anime look", () => {
  assert.equal(defaultVisualGenreForContentFormat("anime"), "anime");
  const resolved = resolveVisualGenre({
    explicit: "auto",
    contentFormat: "anime",
    ideaText: "A host explains cashflow",
  });
  assert.equal(resolved, "anime");
});

test("cinematic craft tags overlay without replacing genre tag", () => {
  const tags = visualGenreSkillTags({ visualGenre: "anime", cinematicCraft: true });
  assert.ok(tags.includes("visual_genre_anime"));
  assert.ok(tags.includes("cinematic_craft"));
  assert.equal(isPhotorealVisualGenre("anime"), false);
  assert.equal(isPhotorealVisualGenre("cinematic"), true);
});

test("genre director skills load look_law templates", () => {
  resetFilmmakingSkillLibraryForTests();
  ensureFilmmakingSkillLibrary();
  assert.ok(getSkill("genre-director-donghua-wuxia")?.templates?.look_law);
  assert.ok(getSkill("genre-director-anime")?.templates?.look_law);
  assert.ok(getSkill("genre-director-cartoon-3d")?.templates?.look_law);
  assert.ok(getSkill("genre-director-comic")?.templates?.look_law);
  assert.ok(getSkill("cinematic-craft-overlay")?.templates?.look_law);
  const wuxia = visualGenreDirective({ visualGenre: "donghua_wuxia", cinematicCraft: true });
  assert.match(wuxia, /Wuxia|Donghua|Xianxia/i);
  assert.match(wuxia, /CINEMATIC CRAFT/i);
  assert.ok(!/8K UHD photorealistic/i.test(wuxia));
  const anime = visualGenreDirective({ visualGenre: "anime", cinematicCraft: true });
  assert.match(anime, /not photoreal/i);
  resetFilmmakingSkillLibraryForTests();
});

test("compileLiveStillPrompt uses director lock and does not inject viral rewrite", () => {
  const scene: any = {
    physicalAction: "Subject raises a bronze sword toward dawn mist on a mountain stair",
    spokenLines: "Protect the morning maker block.",
    cameraDirection: "Wide establishing then slow push-in",
    primaryChange: "Host presents key insight with authoritative gestures",
    visualDescription: "Cyberpunk alley with neon",
  };
  attachSceneMotionLock(scene, { sourceStill: "scene_still" });
  scene.primaryChange = "Host presents key insight with authoritative gestures";

  const { prompt } = compileLiveStillPrompt({
    scene,
    sceneIndexZeroBased: 0,
    aspectRatio: "9:16",
    brief: {
      formatSettings: { visualGenre: "donghua_wuxia", cinematicCraft: true, contentFormat: "story", aspectMode: "portrait", targetDurationSec: 60 },
      visualDirection: "REFERENCE FORMAT that should not restyle the still",
      researchContext: { format: "viral listicle", provenStructure: "hook then payoff" },
    } as any,
  });
  assert.match(prompt, /DIRECTOR STILL LOCK/i);
  assert.match(prompt, /bronze sword/i);
  assert.ok(!/Host presents key insight/i.test(prompt));
  assert.ok(!/REFERENCE FORMAT & RETENTION/i.test(prompt));
  assert.match(prompt, /Donghua|Wuxia/i);
});

test("panelSpecFromLiveScene prefers frozen motionLock action", () => {
  const scene: any = {
    physicalAction: "Subject bows then draws the jian in one continuous arc",
    cameraDirection: "Low-angle hero",
  };
  attachSceneMotionLock(scene, { sourceStill: "storyboard_panel" });
  scene.primaryChange = "valueJob proof beat";
  scene.visualDescription = "totally different set";
  const panel = panelSpecFromLiveScene(scene, 0);
  assert.match(panel.subjectAction, /jian/i);
  assert.match(panel.visualObjective, /jian/i);
});

test("compileLiveMotionPrompt keeps I2V envelope and genre without viral look rewrite", () => {
  const scene: any = {
    physicalAction: "Subject steps into a shaft of window light and opens a leather folio",
    cameraDirection: "Slow push-in",
    image: "https://cdn.example/scene-1.png",
  };
  attachSceneMotionLock(scene, {
    sourceStill: "storyboard_panel",
    stillUrl: scene.image,
    visualGenre: "cinematic",
  });
  const { prompt, fromPersistedLock } = compileLiveMotionPrompt({
    mode: "deep",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 2,
    durationSec: 5,
    scene,
    refLabels: ["INPUT REF [1]: First Frame"],
    isInsertOrSet: false,
    environment: "Loft",
    brief: {
      researchContext: { format: "should not appear as look rewrite" },
      formatSettings: { visualGenre: "cinematic", cinematicCraft: true, contentFormat: "host", aspectMode: "portrait", targetDurationSec: 60 },
    } as any,
  });
  assert.equal(fromPersistedLock, true);
  assert.match(prompt, /LOCKED SPARK SHOT MOTION/i);
  assert.match(prompt, /STORYBOARD STILL AUTHORITY/i);
  assert.ok(!/REFERENCE FORMAT & RETENTION/i.test(prompt));
  assert.ok(!/8K UHD photorealistic/i.test(prompt));
});

test("compileLiveMotionPrompt donghua keeps painterly optics not photoreal 8K", () => {
  const scene: any = {
    physicalAction: "Subject draws a jian and steps into mountain mist",
    cameraDirection: "Slow push-in",
    image: "https://cdn.example/wuxia-1.png",
  };
  attachSceneMotionLock(scene, {
    sourceStill: "storyboard_panel",
    stillUrl: scene.image,
    visualGenre: "donghua_wuxia",
  });
  const { prompt } = compileLiveMotionPrompt({
    mode: "deep",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 1,
    durationSec: 5,
    scene,
    refLabels: ["INPUT REF [1]: First Frame"],
    isInsertOrSet: false,
    environment: "Floating peak",
    brief: {
      formatSettings: { visualGenre: "donghua_wuxia", cinematicCraft: true, contentFormat: "story", aspectMode: "portrait", targetDurationSec: 60 },
    } as any,
  });
  assert.match(prompt, /Donghua|Wuxia|painterly/i);
  assert.match(prompt, /CINEMATIC CRAFT/i);
  assert.ok(!/8K UHD photorealistic/i.test(prompt));
  assert.match(prompt, /Not 8K photoreal|painterly donghua/i);
});

test("sheet compiler injects visual genre and forbids valueJob as picture", () => {
  const result = compileLiveStoryboardSheetPrompt({
    scenes: [
      {
        physicalAction: "Subject turns into rim light and raises a folded letter",
        cameraDirection: "Medium",
      },
    ],
    aspectRatio: "9:16",
    contentFormat: "story",
    formatSettings: { visualGenre: "noir", cinematicCraft: true },
  });
  assert.match(result.prompt, /VISUAL GENRE: Noir/i);
  assert.match(result.prompt, /never valueJob/i);
});

test("getEffectiveFormatSettings carries visualGenre and cinematicCraft", () => {
  const fmt = getEffectiveFormatSettings({
    formatSettings: {
      targetDurationSec: 30,
      aspectMode: "portrait",
      contentFormat: "story",
      visualGenre: "donghua_wuxia",
      cinematicCraft: true,
    },
  });
  assert.equal(fmt.visualGenre, "donghua_wuxia");
  assert.equal(fmt.cinematicCraft, true);
});

test("buildStillSubjectLine locks donghua medium instead of photoreal", () => {
  const line = buildStillSubjectLine({
    resolvedSubject: "main",
    contentFormat: "story",
    visualGenre: "donghua_wuxia",
  });
  assert.match(line, /Donghua medium lock/i);
  assert.ok(!/8K/i.test(line));
});
