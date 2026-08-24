/**
 * 2026 Creator Discipline Production Prompt Packs & Anti-Slop Discipline
 * Fixed, structured mode recipes for Express (Narrator), Standard (Hybrid), and Deep (Cinematic).
 * 90% fixed style/discipline pack + 10% injected story content.
 */

import type { Brand, Character, ProductionBrief, Production } from "../../domain/types";

export const ANTI_SLOP_RULES = `
ANTI-SLOP & CONTINUITY LAWS:
1. SUBJECT LOCK: The primary character must be identical in face, hair, and wardrobe to the provided character reference sheet across every single frame/clip. Absolutely no character drift or face morphing.
2. SET CONTINUITY: Same set, backdrop, architectural details, and lighting atmosphere across all beats. No random environment resets mid-production.
3. SINGLE ACTION FOCUS: Render exactly ONE primary physical action per beat/scene. No multi-action confusion or random subject movement.
4. ON-SCREEN TYPOGRAPHY: On-screen text overlays must be bold, short (<=6-8 words), high-contrast, placed in safe margins (lower-third), with zero gibberish text or deformed characters.
5. OPTICAL DISCIPLINE: 8K UHD photorealistic render, prime cinema lens, natural depth of field, coherent color grade, zero AI distortion or extra limbs.
`.trim();

export interface PromptPackOptions {
  brand: Brand;
  character?: Character;
  brief: ProductionBrief;
  production: Production;
  aspectRatio: string;
  characterRefUrl?: string;
}

export interface ModePromptPack {
  mode: "express" | "standard" | "deep";
  globalLockBlock: string;
  imagePromptTemplate: (sceneIndex: number, totalScenes: number, sceneText: string, actionDescription: string, framing: string) => string;
  videoPromptTemplate: (targetDurationSec: number, sceneDescriptions: string) => string;
  voiceScript: string;
}

export function buildCompleteVoiceScript(brief: ProductionBrief): string {
  const hook = typeof brief.hook === "string" ? brief.hook.trim() : "";
  const outline = typeof brief.scriptOutline === "string" ? brief.scriptOutline.trim() : "";

  let cta = "";
  if (typeof brief.caption === "string" && brief.caption.trim()) {
    const firstSentence = brief.caption.split(/[.!?\n]/)[0]?.trim();
    if (firstSentence && firstSentence.length > 5 && firstSentence.length < 120) {
      cta = firstSentence;
    }
  }
  if (!cta && brief.storyboard && brief.storyboard.length > 0) {
    const lastScene = brief.storyboard[brief.storyboard.length - 1];
    cta = lastScene?.onScreenText || lastScene?.scriptSnippet || "";
  }
  if (!cta) {
    cta = "Follow for more strategies.";
  }

  const clean = (str: string) =>
    str
      .replace(/[*_#`~\[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const cleanHook = clean(hook);
  const cleanOutline = clean(outline);
  const cleanCta = clean(cta);

  const parts = [cleanHook, cleanOutline, cleanCta].filter(Boolean);
  const fullScript = parts.join(". ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ");

  return fullScript.slice(0, 600);
}

export function getProductionPromptPack(options: PromptPackOptions): ModePromptPack {
  const { brand, character, brief, production, aspectRatio, characterRefUrl } = options;
  const rawMode = (production.mode || brief.productionMode || "standard").toLowerCase();
  const mode: "express" | "standard" | "deep" =
    rawMode === "deep" || rawMode === "cinematic"
      ? "deep"
      : rawMode === "express" || rawMode === "narrator"
      ? "express"
      : "standard";

  const charName = character?.name || "Host";
  const charStyle = character?.style || "Executive Presenter";
  const charTraits = (character?.traits || ["Visionary", "Authoritative", "Magnetic"]).join(", ");
  const environmentStr = brief.visualDirection || "a high-end executive studio with refined architectural lighting";

  const globalLockBlock = `
CHARACTER (LOCKED): Primary subject is "${charName}" (Style: ${charStyle}, Traits: ${charTraits}).${characterRefUrl ? ` Reference Sheet: ${characterRefUrl}` : ""}
ENVIRONMENT (LOCKED SET): Location is "${environmentStr}".
BRAND IDENTITY: ${brand.name} (${brand.niche || "Media OS"}).
ASPECT RATIO: ${aspectRatio}.
${ANTI_SLOP_RULES}
`.trim();

  const voiceScript = buildCompleteVoiceScript(brief);

  if (mode === "express") {
    // EXPRESS / NARRATOR RECIPE
    return {
      mode: "express",
      globalLockBlock,
      voiceScript,
      imagePromptTemplate: (sIdx, totalScenes, sceneText, actionDesc, framing) => `
${globalLockBlock}

EXPRESS NARRATOR KEYFRAME (Panel ${sIdx + 1} of ${totalScenes}):
Visual Action: ${actionDesc}
Camera Framing: ${framing}
ON-SCREEN TEXT OVERLAY LAW: Render bold, readable, high-contrast typography overlay on the image: "${sceneText}" (bold typography, safe margins, high contrast, <=6-8 words).
Hook Context: "${brief.hook}".
Clear sequential storytelling. Crisp lower-third text backdrop.
`.trim(),
      videoPromptTemplate: () => "",
    };
  }

  if (mode === "deep") {
    // DEEP / CINEMATIC RECIPE
    return {
      mode: "deep",
      globalLockBlock,
      voiceScript,
      imagePromptTemplate: (sIdx, totalScenes, sceneText, actionDesc, framing) => `
${globalLockBlock}

CINEMATIC MASTER KEYFRAME (Scene ${sIdx + 1} of ${totalScenes}):
Sequence Beat: ${actionDesc}
Camera Optics & Movement: ${framing}, anamorphic lens prime optics, dynamic camera tracking.
ON-SCREEN TYPOGRAPHY LAW: Render high-contrast crisp text overlay: "${sceneText}" (bold typography, safe bottom margins).
Set Lighting: Atmospheric rim lighting, studio set continuity, 8K photorealistic render.
`.trim(),
      videoPromptTemplate: (durationSec, sceneDescriptions) => `
${globalLockBlock}

SINGLE-PASS CINEMATIC MOTION SYNTHESIS (Duration: ${durationSec}s):
Animate the complete storyboard in one continuous, seamless motion pass (Scene 1 -> Scene N).
Story Sequence: ${sceneDescriptions}
Character Lock: ${charName} (must remain identical in face, hair, and wardrobe throughout full duration).
Set Lock: ${environmentStr} (continuous camera movement, zero environment resets).
Visual Pacing: Smooth cinematic transitions between scenes, matching audio timing.
No AI distortion, no morphing faces, no extra limbs.
`.trim(),
    };
  }

  // STANDARD / HYBRID RECIPE (default)
  return {
    mode: "standard",
    globalLockBlock,
    voiceScript,
    imagePromptTemplate: (sIdx, totalScenes, sceneText, actionDesc, framing) => `
${globalLockBlock}

HYBRID STORYBOARD PANEL (Panel ${sIdx + 1} of ${totalScenes}):
Action: ${actionDesc}
Camera Framing: ${framing}
ON-SCREEN TEXT OVERLAY LAW: Render bold typography overlay: "${sceneText}" (high contrast, safe lower-third margin).
Clear host-on-camera perspective with high-impact visual engagement.
`.trim(),
    videoPromptTemplate: (durationSec, sceneDescriptions) => `
${globalLockBlock}

SINGLE-PASS MASTER HYBRID VIDEO SYNTHESIS (Target Duration: ${durationSec}s):
Animate sequential storyboard beats from reference keyframes in exact order 1->N.
Story Arc: ${sceneDescriptions}
Character Lock: ${charName} (locked identity on camera).
Set Lock: ${environmentStr}.
Motion Pacing: Host on-camera presentation with clean scene transitions matching narration.
Zero face morphing, zero visual slop.
`.trim(),
  };
}
