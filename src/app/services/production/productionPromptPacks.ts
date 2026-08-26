/**
 * 2026 Creator Discipline Production Prompt Packs & Anti-Slop Discipline
 * Fixed, structured mode recipes for Express (Narrator), Standard (Hybrid), and Deep (Cinematic).
 * 90% fixed style/discipline pack + 10% injected story content.
 */

import type { Brand, Character, ProductionBrief, Production, MemoryItem } from "../../domain/types";
import { buildRankedBrandLaws } from "../memory/rankBrandLaws";

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
  memoryItems?: MemoryItem[];
}

export interface ModePromptPack {
  mode: "express" | "standard" | "deep";
  globalLockBlock: string;
  imagePromptTemplate: (sceneIndex: number, totalScenes: number, sceneText: string, actionDescription: string, framing: string) => string;
  videoPromptTemplate: (targetDurationSec: number, sceneDescriptions: string) => string;
  voiceScript: string;
}

export function buildCompleteVoiceScript(brief: ProductionBrief, targetDurationSec: number = 60): string {
  const clean = (str: string) =>
    str
      .replace(/[*_#`~\[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // If structured beats exist, assemble the voice script directly from beat spoken lines
  if (brief.beats && brief.beats.length > 0) {
    const beatLines = brief.beats
      .map((b) => clean(b.spokenLines))
      .filter((line) => line.length > 0);

    if (beatLines.length > 0) {
      const fullScript = beatLines.join(" ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ");
      // Allow ~15-20 characters per second of target duration (e.g. 300s -> ~5000 chars, 60s -> ~1000 chars)
      const maxCharBudget = Math.max(800, targetDurationSec * 18);
      return fullScript.slice(0, maxCharBudget);
    }
  }

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

  const cleanHook = clean(hook);
  const cleanOutline = clean(outline);
  const cleanCta = clean(cta);

  const parts = [cleanHook, cleanOutline, cleanCta].filter(Boolean);
  const fullScript = parts.join(". ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ");

  const maxCharBudget = Math.max(800, targetDurationSec * 18);
  return fullScript.slice(0, maxCharBudget);
}

export function getProductionPromptPack(options: PromptPackOptions): ModePromptPack {
  const { brand, character, brief, production, aspectRatio, characterRefUrl, memoryItems = [] } = options;
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
  const rankedLaws = buildRankedBrandLaws(memoryItems).lawsBlock;

  const globalLockBlock = `
CHARACTER (LOCKED): Primary subject is "${charName}" (Style: ${charStyle}, Traits: ${charTraits}).${characterRefUrl ? ` Reference Sheet: ${characterRefUrl}` : ""}
ENVIRONMENT (LOCKED SET): Location is "${environmentStr}".
BRAND IDENTITY: ${brand.name} (${brand.niche || "Media OS"}).
ASPECT RATIO: ${aspectRatio}.
RANKED BRAND MEMORY & EXECUTIVE LAWS:
${rankedLaws}
${ANTI_SLOP_RULES}
`.trim();

  const effectiveTargetDurationSec =
    (production as any)?.formatSettings?.targetDurationSec ||
    (production as any)?.targetDurationSec ||
    (brief as any)?.targetDurationSec ||
    (brand as any)?.formatSettings?.targetDurationSec ||
    60;
  const voiceScript = buildCompleteVoiceScript(brief, effectiveTargetDurationSec);

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
    // DEEP / CINEMATIC RECIPE (Lam One-Take System with Timestamp Blocks & Speech in Picture)
    return {
      mode: "deep",
      globalLockBlock,
      voiceScript,
      imagePromptTemplate: (sIdx, totalScenes, sceneText, actionDesc, framing) => `
${globalLockBlock}

CINEMATIC MASTER KEYFRAME (Scene ${sIdx + 1} of ${totalScenes}):
INPUT REF [1]: Character Reference Sheet (${charName})
INPUT REF [2]: Master Storyboard Grid Reference
ACTION: ${actionDesc}
CAMERA: ${framing}, anamorphic prime optics, dynamic tracking.
ON-SCREEN TYPOGRAPHY LAW: Render high-contrast crisp text overlay: "${sceneText}" (bold typography, safe bottom margins).
Set Lighting: Atmospheric rim lighting, studio set continuity, 8K photorealistic render.
`.trim(),
      videoPromptTemplate: (durationSec, sceneDescriptions) => `
GLOBAL LOCK:
CHARACTER (from sheet image): ${charName} (Style: ${charStyle}, Traits: ${charTraits}). Reference sheet is image 1.
LOCATION / SET (locked): ${environmentStr}.
STYLE: ${brand.name} (${brand.niche || "Executive"}), cinematic anamorphic look, 8K photorealistic.
ONLY spoken words are inside quotation marks.

TIMELINE BEATS (0-${durationSec}s):
${sceneDescriptions}

CINEMATIC MOTION LAWS:
- Single continuous camera move across all beats (push-in, lock-off, or tracking).
- Scene N opens on Scene N-1's exact end state.
- Exactly ONE primary physical action per timestamp block.
- Absolute subject identity, hair, and wardrobe lock from reference sheet. Zero face morphing or AI slop.
- Ambient audio and environment sound design; quoted speech delivered on-camera.
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
INPUT REF [1]: Character Reference Sheet (${charName})
INPUT REF [2]: Master Storyboard Grid Reference
ACTION: ${actionDesc}
CAMERA: ${framing}
ON-SCREEN TEXT OVERLAY LAW: Render bold typography overlay: "${sceneText}" (high contrast, safe lower-third margin).
Clear host-on-camera perspective with high-impact visual engagement.
`.trim(),
    videoPromptTemplate: (durationSec, sceneDescriptions) => `
${globalLockBlock}

LAM ONE-TAKE HYBRID PRESENTATION SEQUENCE (${aspectRatio}, Target Duration: ${durationSec}s):
INPUT REF [1]: Primary Character Reference Sheet (${charName})
INPUT REF [2]: Master Storyboard Grid / Keyframe Reference
GLOBAL LOCK: Primary subject is "${charName}" (${charStyle}). Set is "${environmentStr}". Look lives in reference images — text describes physical change only.

TIMELINE & BEAT STRUCTURE:
${sceneDescriptions}

HYBRID PRESENTATION LAWS:
- Host-on-camera perspective with high retention visual engagement.
- Sequential beat animation from reference keyframes in exact order (1 -> N).
- Continuous set lighting and atmosphere; zero random environment resets.
- Clean host presentation pacing matching audio narration.

AUDIO & SPEECH POLICY:
- Ambient sound design and synchronized SFX in chronological sequence.
- Explicit "no background music" unless brand settings enable music.
- Short quoted dialogue occurs only inside timestamp beats.
`.trim(),
  };
}
