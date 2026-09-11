/**
 * Storyboard structure plan prompts — OS compiler for LLM panel planning.
 * Prefer Spec-linked / brief storyboard when present; AssetService only executes.
 */

import type { Brand, Character, ProductionBrief } from "../../domain/types";
import {
  contentFormatDirective,
  formatSubjectRoleLabel,
  normalizeCanonicalContentFormat,
} from "./contentFormatDirectives";
import { getEffectiveContentFormat } from "./characterSheetGate";
import { resolveLiveVisualGenre, visualGenreDirective } from "./visualGenreDirectives";

export function compileStoryboardPlanPrompt(params: {
  mode: "express" | "standard" | "deep";
  aspectRatio: string;
  brief: ProductionBrief;
  brand: Brand;
  character?: Character | null;
  contentFormat?: string | null;
}): { systemInstruction: string; prompt: string; compiler: "storyboard_plan" } {
  const { mode, aspectRatio, brief, brand, character } = params;
  const format = normalizeCanonicalContentFormat(
    params.contentFormat ||
      getEffectiveContentFormat({ brand, brief, character, formatSettings: brief.formatSettings })
  );
  const labels = formatSubjectRoleLabel(format, "main");
  const subjectName = character?.name || labels.nameFallback;
  const subjectStyle = character?.style || labels.styleFallback;
  const formatLaw = contentFormatDirective(format);
  const isStoryOrAnime = format === "story" || format === "anime";
  const visualGenre = resolveLiveVisualGenre({
    formatSettings: brief.formatSettings,
    contentFormat: format,
    brief,
  });
  const genreLaw = visualGenreDirective({
    visualGenre,
    cinematicCraft: brief.formatSettings?.cinematicCraft !== false,
  });
  const subjectLine =
    format === "faceless"
      ? `FORMAT SUBJECT: Faceless / VO-led — prefer B-roll and environment panels (no invented host).`
      : `LEAD: "${subjectName}" (${subjectStyle})`;
  const hook = typeof brief.hook === "string" ? brief.hook : "";

  const formattedBeatsBlock =
    brief.beats && brief.beats.length > 0
      ? `
STRUCTURED PRODUCTION BEATS (MANDATORY 1-TO-1 PANEL MAPPING):
${brief.beats
  .map(
    (b, i) =>
      `Beat ${i + 1} ${b.timecode} [${b.valueJob.toUpperCase()}]: "${b.spokenLines}" | ONSCREEN: "${b.onScreenText}" | CAMERA: ${b.cameraDirection || "Standard"}`
  )
  .join("\n")}
`
      : "";

  if (mode === "deep") {
    return {
      compiler: "storyboard_plan",
      systemInstruction: `You are SPARK's Senior Film Director specializing in Continuous One-Take Cinematic Craft.
Structure a seamless continuous one-take sequence matching the brief's duration and beats.
CONTINUITY LAWS:
1. Stage N's startState MUST open EXACTLY on Stage N-1's endState.
2. Exactly ONE primary physical/story change per stage.
3. ${isStoryOrAnime ? "Locked character identity, wardrobe, and world environment across all panels." : "Locked character identity, wardrobe, and studio set across all panels."}
4. Concrete camera direction required every panel.
5. Forbid montage cuts, teleportation, or stock cutaways. Return valid JSON only.`,
      prompt: `
Create a continuous one-take cinematic storyboard (${aspectRatio}) for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
${subjectLine}
FORMAT LAW: ${formatLaw}
VISUAL GENRE LAW:
${genreLaw}
VALUE JOB IS EDITORIAL ONLY: valueJob labels structure (hook/proof/cta). visualDescription, startState, primaryChange, endState, and physicalAction must be concrete visible blocking — never valueJob jargon, never spoken lines as the picture.
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"
VISUAL DIRECTION: "${brief.visualDirection}"
${formattedBeatsBlock}
CONTINUITY LAWS FOR DEEP / CINEMATIC MODE:
- Continuous one-take staging across all beats.
- Every panel has:
  * valueJob: hook | problem | context | proof | example | myth_bust | payoff | cta
  * spokenLines: Complete substantive spoken line for host/VO
  * onScreenText: <=6-8 uppercase words
  * startState -> primaryChange -> endState (one change only)
  * cameraDirection: Specific cinematic motion (e.g. slow push-in, motivated tracking)

Return valid JSON with this exact structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-8s",
      "valueJob": "hook",
      "shotList": "${isStoryOrAnime ? `Cinematic ${aspectRatio} narrative establishing shot of ${subjectName}` : `Presenter direct-to-camera ${aspectRatio} master shot establishing scene`}",
      "cameraDirection": "Slow cinematic push-in with subtle lateral glide",
      "transitions": "Continuous one-take flow",
      "startState": "${isStoryOrAnime ? `${subjectName} established in world setting, engaged in scene action (never direct-to-camera lens address)` : `Host stands in studio, looking into lens, holding tablet with initial data`}",
      "primaryChange": "${isStoryOrAnime ? `${subjectName} initiates motion as environment and lighting react to narrative tension` : `Host turns slightly as ambient background lighting dims to emphasize key metric`}",
      "endState": "${isStoryOrAnime ? `${subjectName} framed dynamically within environment, establishing scene continuity` : `Host centered in frame, gesturing right, backlight highlighting focused expression`}",
      "onScreenText": "${hook.slice(0, 50)}",
      "pacing": "Deliberate and cinematic",
      "spokenLines": "${hook.slice(0, 80)}",
      "scriptSnippet": "${hook.slice(0, 80)}",
      "visualDescription": "${isStoryOrAnime ? `Cinematic atmospheric opening shot authentic to narrative genre and world` : `High contrast executive opening shot with locked lighting and host presence`}"
    }
  ],
  "thumbnails": [
    { "id": "t1", "variant": "A", "concept": "${isStoryOrAnime ? `High-contrast cinematic keyframe with ${subjectName} in dynamic narrative stance` : `High-contrast cinematic keyframe with host authority expression and curiosity hook`}" },
    { "id": "t2", "variant": "B", "concept": "Cinematic split lighting with illuminated metric graphic breakdown" },
    { "id": "t3", "variant": "C", "concept": "${isStoryOrAnime ? `Dramatic narrative composition of ${subjectName} in world environment` : `Minimalist premium typography overlay on sharp host portrait in studio`}" }
  ]
}
`,
    };
  }

  if (mode === "express") {
    return {
      compiler: "storyboard_plan",
      systemInstruction: `You are SPARK's Rapid Short-Form Creative Director.
Structure an Express Narrator storyboard where high-impact visual stills support a FULL spoken VO script.
EXPRESS LAWS:
1. Every panel has a concrete valueJob, full substantive spokenLines, and <=6-8 word onScreenText.
2. Clean sequential visual storytelling with crisp typography safe margins.
3. ${format === "faceless" ? "Faceless visuals — no invented host face." : "Locked lead identity and studio set."} Return valid JSON only.`,
      prompt: `
Create an express narrator production storyboard (9:16 vertical) for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
${subjectLine}
FORMAT LAW: ${formatLaw}
VISUAL GENRE LAW:
${genreLaw}
VALUE JOB IS EDITORIAL ONLY: valueJob labels structure (hook/proof/cta). visualDescription, startState, primaryChange, endState, and physicalAction must be concrete visible blocking — never valueJob jargon, never spoken lines as the picture.
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"
${formattedBeatsBlock}
EXPRESS NARRATOR RULES:
- Every panel has:
  * valueJob: hook | problem | context | proof | example | myth_bust | payoff | cta
  * spokenLines: Full VO sentence(s) for that beat
  * onScreenText: <=6-8 words, high-contrast lower-third ready
  * visualDescription / startState / primaryChange / endState for continuity

Return valid JSON with this exact structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-6s",
      "valueJob": "hook",
      "shotList": "Presenter direct-to-camera dynamic hook",
      "cameraDirection": "Quick snap push-in",
      "transitions": "Continuous flow",
      "startState": "Host centered looking directly into camera with intense hook expression",
      "primaryChange": "Host gestures dynamically as bold headline appears",
      "endState": "Host holding position pointing to key visual",
      "onScreenText": "${hook.slice(0, 45)}",
      "pacing": "Fast hook",
      "spokenLines": "${hook.slice(0, 80)}",
      "scriptSnippet": "${hook.slice(0, 80)}",
      "visualDescription": "High energy vertical framing with clean studio lighting"
    }
  ],
  "thumbnails": [
    { "id": "t1", "variant": "A", "concept": "High-energy face reaction with bold hook text overlay" },
    { "id": "t2", "variant": "B", "concept": "Curiosity gap split graphic in dark mode" },
    { "id": "t3", "variant": "C", "concept": "Clean bold typography card with brand accent" }
  ]
}
`,
    };
  }

  return {
    compiler: "storyboard_plan",
    systemInstruction: `You are SPARK's Senior Production Producer.
Structure a balanced ${isStoryOrAnime ? "Cinematic Story storyboard (narrative character blocking + scene atmosphere)" : "Hybrid Presentation storyboard (host-on-camera + overlay text)"}.
${isStoryOrAnime ? "NARRATIVE CONTINUITY LAWS:" : "HYBRID LAWS:"}
1. Every panel has valueJob, exact ${isStoryOrAnime ? "character spoken/narrated" : "host spoken"} lines, and onScreenText overlay.
2. startState -> primaryChange -> endState with clear single action focus.
3. Concrete camera direction per panel (no generic descriptors).
4. ${isStoryOrAnime ? "Locked character identity, wardrobe, and world environment across all panels." : "Locked character identity, wardrobe, and studio set across all panels."} Return valid JSON only.`,
    prompt: `
Create a ${isStoryOrAnime ? "cinematic narrative storyboard" : "hybrid presentation storyboard"} (${aspectRatio}) for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
${subjectLine}
FORMAT LAW: ${formatLaw}
VISUAL GENRE LAW:
${genreLaw}
VALUE JOB IS EDITORIAL ONLY: valueJob labels structure (hook/proof/cta). visualDescription, startState, primaryChange, endState, and physicalAction must be concrete visible blocking — never valueJob jargon, never spoken lines as the picture.
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"
VISUAL DIRECTION: "${brief.visualDirection}"
${formattedBeatsBlock}
${isStoryOrAnime ? "NARRATIVE CINEMATIC RULES:" : "HYBRID PRESENTATION RULES:"}
- Every panel has:
  * valueJob: hook | problem | context | proof | example | myth_bust | payoff | cta
  * spokenLines: Exact lines for ${isStoryOrAnime ? "dialogue / narration" : "host on camera"}
  * onScreenText: <=6-8 words in uppercase
  * startState -> primaryChange -> endState
  * cameraDirection: Concrete camera framing

Return valid JSON with this exact structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-8s",
      "valueJob": "hook",
      "shotList": "${isStoryOrAnime ? `Cinematic ${aspectRatio} narrative framing of ${subjectName}` : `Presenter direct-to-camera vertical framing`}",
      "cameraDirection": "Push-in slow zoom",
      "transitions": "Continuous flow",
      "startState": "${isStoryOrAnime ? `${subjectName} in narrative scene environment, engaged in story context (no direct lens address)` : `Host standing in executive studio addressing viewer`}",
      "primaryChange": "${isStoryOrAnime ? `${subjectName} shifts stance as dynamic lighting emphasizes key conflict` : `Host raises tablet presenting the challenge`}",
      "endState": "${isStoryOrAnime ? `${subjectName} framed with focused expression in story setting` : `Host centered with focused expression holding visual aid`}",
      "onScreenText": "${hook.slice(0, 50)}",
      "pacing": "Fast hook",
      "spokenLines": "${hook.slice(0, 80)}",
      "scriptSnippet": "${hook.slice(0, 80)}",
      "visualDescription": "${isStoryOrAnime ? `Cinematic narrative opening frame with world-authentic lighting and character presence` : `High contrast executive presenter opening frame`}"
    }
  ],
  "thumbnails": [
    { "id": "t1", "variant": "A", "concept": "${isStoryOrAnime ? `High-contrast cinematic narrative keyframe of ${subjectName}` : `High-contrast split screen with presenter expression and bold hook`}" },
    { "id": "t2", "variant": "B", "concept": "Glowing metric dashboard with curiosity-gap text overlay" },
    { "id": "t3", "variant": "C", "concept": "Minimalist dark mode typography card with brand accent highlight" }
  ]
}
`,
  };
}

/** Prefer existing Spec/brief panels over inventing a new structure. */
export function shouldReuseExistingStoryboard(params: {
  forceRegenerate?: boolean;
  brief: ProductionBrief;
  hasProductionSpec?: boolean;
}): boolean {
  const { forceRegenerate, brief, hasProductionSpec } = params;
  if (forceRegenerate) return false;
  const sb = brief.storyboard;
  if (!Array.isArray(sb) || sb.length === 0) return false;
  const allShotIds = sb.every((s: any) => typeof s?.shotId === "string" && s.shotId.length > 0);
  if (allShotIds) return true;
  if (hasProductionSpec) return true;
  // Polished brief panels with spoken lines / visual beats — reuse rather than invent
  return sb.some(
    (s: any) =>
      (typeof s?.spokenLines === "string" && s.spokenLines.length > 8) ||
      (typeof s?.visualDescription === "string" && s.visualDescription.length > 8) ||
      (typeof s?.primaryChange === "string" && s.primaryChange.length > 4)
  );
}
