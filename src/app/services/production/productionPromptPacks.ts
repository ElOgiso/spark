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

  const hook = typeof brief.hook === "string" ? clean(brief.hook) : "";
  const beats = brief.beats || [];
  let cta = typeof brief.spokenCta === "string" ? clean(brief.spokenCta) : "";
  if (!cta && typeof brief.caption === "string" && brief.caption.trim()) {
    const firstSentence = clean(brief.caption.split(/[.!?\n]/)[0] || "");
    if (firstSentence && firstSentence.length > 5 && firstSentence.length < 120) {
      cta = firstSentence;
    }
  }
  if (!cta && brief.storyboard && brief.storyboard.length > 0) {
    const lastScene = brief.storyboard[brief.storyboard.length - 1];
    cta = clean(lastScene?.spokenLines || lastScene?.scriptSnippet || lastScene?.onScreenText || "");
  }
  if (!cta) {
    cta = "Follow for more strategies.";
  }

  const lines: string[] = [];
  if (beats.length > 0) {
    const firstBeatSpoken = clean(beats[0].spokenLines || "");
    const hookAlreadyInFirstBeat = hook && firstBeatSpoken.toLowerCase().includes(hook.toLowerCase().slice(0, 20));

    if (hook && !hookAlreadyInFirstBeat && beats[0].valueJob !== "hook") {
      lines.push(hook);
    }

    for (let i = 0; i < beats.length; i++) {
      const beatSpoken = clean(beats[i].spokenLines || "");
      if (beatSpoken) {
        lines.push(beatSpoken);
      }
    }

    const lastBeatSpoken = clean(beats[beats.length - 1].spokenLines || "");
    const ctaAlreadyInLastBeat = cta && lastBeatSpoken.toLowerCase().includes(cta.toLowerCase().slice(0, 20));

    if (cta && !ctaAlreadyInLastBeat && beats[beats.length - 1].valueJob !== "cta") {
      lines.push(cta);
    }
  } else {
    if (hook) lines.push(hook);
    if (brief.scriptOutline) lines.push(clean(brief.scriptOutline));
    if (cta) lines.push(cta);
  }

  const fullScript = lines.join(" ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim();
  const maxCharBudget = Math.max(1000, targetDurationSec * 25);
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

export interface TakeMotionPanel {
  panelIndex: number;
  shotFraming?: string;
  action?: string;
  spokenLines?: string;
  onScreenText?: string;
  audio?: "vo" | "talent";
}

export interface TakeMotionPromptParams {
  mode: "express" | "standard" | "deep";
  aspectRatio: string;
  takeIndex: number;
  totalTakes: number;
  takeDurationSec: number;
  panels: TakeMotionPanel[];
  characterName?: string;
  characterStyle?: string;
  environment?: string;
}

export function buildTakeMotionPrompt(params: TakeMotionPromptParams): string {
  const {
    mode,
    aspectRatio,
    takeIndex,
    totalTakes,
    takeDurationSec,
    panels,
    characterName = "Host",
    characterStyle = "Executive Presenter",
    environment = "Modern High-Contrast Production Studio",
  } = params;

  const isDeep = mode === "deep";
  const isPortrait = aspectRatio.includes("9:16") || aspectRatio.toLowerCase().includes("portrait");
  const cellAspect = isPortrait ? "9:16" : "16:9";

  const panelListText = panels.map((p) => {
    const pNum = p.panelIndex + 1;
    const framing = p.shotFraming || (p.panelIndex === 0 ? "Wide/Medium establishing shot" : "Medium dynamic action shot");
    const act = p.action || "Host presents key core insight";
    const spoken = p.spokenLines ? ` Dialogue: "${p.spokenLines.replace(/"/g, "'")}"` : "";
    const onScreen = p.onScreenText ? ` [On-Screen: "${p.onScreenText.slice(0, 40)}"]` : "";
    return `- PANEL ${pNum}: [${framing}] ${act}.${spoken}${onScreen}`;
  }).join("\n");

  const modeDirectives = isDeep
    ? `
DEEP / CINEMATIC DIRECTIVES:
- No burned text, no subtitles, no captions on frame.
- Audio: Diegetic only — natural room ambience, subtle foley, subject-driven sound.
- No narrator voiceover bed.
- Aspect: ${cellAspect}.
`.trim()
    : `
STANDARD / HYBRID DIRECTIVES:
${panels.some((p) => p.audio === "vo") ? "- B-ROLL / EXTERNAL VO: No on-character speech lipsync; leave acoustic room for external voiceover bed; minimal subtle diegetic audio." : "- TALENT SPEECH: Direct on-camera speech synchronized with presenter performance; diegetic sound design."}
- No random subtitles unless short on-screen graphic text (<=6 words).
- Aspect: ${cellAspect}.
`.trim();

  return `
LOCKED SPARK MOTION INSTRUCTION — TAKE ${takeIndex} OF ${totalTakes} (${takeDurationSec}s):

INPUT REFERENCES:
- IMAGE 1 = Character Reference Sheet (Identity Law for "${characterName}").
- IMAGE 2 = Storyboard Take Grid (Sequential Shot List).

BASE ANIMATION DIRECTIVE:
Use the reference STORYBOARD GRID as the shot list and the CHARACTER SHEET as identity law.
Animate this take into one continuous clip in PANEL ORDER (1 -> ${panels.length}).
Preserve exact character from the sheet (face, hair, body, wardrobe, colors: "${characterStyle}").
Preserve set, lighting, style from the grid ("${environment}"). Do not redesign.
Smooth camera only as labeled. One primary action per panel.
Natural pacing. No skipped panels. No new characters.
End on a held frame matching the LAST panel.

PANEL BREAKDOWN FOR THIS TAKE:
${panelListText}

${modeDirectives}

NEGATIVE LAWS:
No face morphing, no outfit change, no extra limbs, no shuffled panel order, no title cards, no watermarks, no glitch artifacts. Do not treat the grid as an unrelated collage to invent a new story.
`.trim();
}

export interface SceneMotionPromptParams {
  mode: "standard" | "deep" | "express";
  aspectRatio: string;
  sceneIndex: number;
  totalScenes: number;
  durationSec: number;
  shotFraming?: string;
  action?: string;
  spokenLines?: string;
  onScreenText?: string;
  audio?: string;
  endPose?: string;
  characterName?: string;
  characterStyle?: string;
  environment?: string;
}

export function buildSceneMotionPrompt(params: SceneMotionPromptParams): string {
  const {
    mode,
    aspectRatio,
    sceneIndex,
    totalScenes,
    durationSec,
    shotFraming = "Medium dynamic shot",
    action = "Host presents key insight with authoritative gestures",
    spokenLines,
    onScreenText,
    audio,
    endPose = "Resolving poised posture holding frame",
    characterName = "Host",
    characterStyle = "Executive Presenter",
    environment = "Modern High-Contrast Production Studio",
  } = params;

  const isDeep = mode === "deep";
  const spoken = spokenLines ? ` Dialogue: "${spokenLines.replace(/"/g, "'")}"` : "";

  const audioDirectives = isDeep
    ? "Diegetic natural sound, room acoustic ambience, subtle foley. No voiceover narration."
    : audio === "vo"
    ? "Clean visual motion leaving acoustic space for external voiceover bed; subtle diegetic foley."
    : "Synchronized on-camera speech performance with natural lip movement and diegetic acoustics.";

  return `
LOCKED SPARK SHOT MOTION — SHOT ${sceneIndex} OF ${totalScenes} (${durationSec}s):

IMAGE 1 (First Frame Reference) = Single Scene Keyframe Still.
IMAGE 2 (Optional Identity Ref) = Character Reference Sheet for "${characterName}".

ANIMATION INSTRUCTION:
- Begin precisely from the first frame image (IMAGE 1). Animate the continuous ${durationSec}s action seamlessly from that starting composition.
- Camera Framing & Movement: ${shotFraming}. Smooth cinematic camera motion.
- Subject Action: ${action}.${spoken}
- Character Consistency: Strict facial, hair, and wardrobe fidelity to "${characterName}" (${characterStyle}).
- Environment: Set in "${environment}". Maintain lighting, textures, and depth of field.
- Resolving End Pose: Gracefully transition into "${endPose}".
- Audio / Performance: ${audioDirectives}

CRITICAL PRODUCTION LAWS:
- Single continuous camera shot. NO jump cuts. NO transitions within this shot.
- NO multi-panel grids or split frames.
- Professional cinematic motion, natural motion blur, realistic physics.
`.trim();
}


