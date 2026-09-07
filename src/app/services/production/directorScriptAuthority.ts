/**
 * Director Script Authority — production content before generation spend.
 *
 * Law:
 *   spokenLines  = audio performance only (never visual glyphs in I2V/still prompts)
 *   physicalAction = visible body/camera/environment change only
 *   onScreenText = captions stage only
 *
 * Planner meta ("Open with a strong hook…", "Host presents key insight…") must NEVER
 * become the I2V Subject Action.
 */

export interface DirectorSceneScript {
  physicalAction: string;
  spokenLines: string;
  onScreenText: string;
  /** True when physicalAction was repaired from meta/empty. */
  repaired: boolean;
  /** True when action looked like planner jargon. */
  wasMeta: boolean;
  source: "scene" | "beat" | "shot" | "repaired" | "empty";
}

/** Lexicon that must not drive live image/video generation as "action". */
export const PLANNER_META_PATTERNS: RegExp[] = [
  /\bhost presents\b/i,
  /\bkey (core )?insight\b/i,
  /\bopen with a strong hook\b/i,
  /\bestablish the problem\b/i,
  /\bhere'?s the key takeaway\b/i,
  /\bfollow for more\b/i,
  /\bblueprint coverage\b/i,
  /\bvalue job\b/i,
  /\bbeat\s*\d+\b/i,
  /\bphase\s*\d+\b/i,
  /\bproduction reason\b/i,
  /\bnarrative function\b/i,
  /\bauthoritative gestures\b/i,
  /\bsave this now\b/i,
  /\bconversion prompt\b/i,
  /\bsystematic leverage\b/i,
  /\bthe non-obvious shift\b/i,
  /\bthe core bottleneck\b/i,
  /\bwhat if\b.+\?/i,
];

export function isPlannerMetaText(text?: string | null): boolean {
  const t = String(text || "").trim();
  if (!t) return true;
  if (t.length < 12) return true;
  return PLANNER_META_PATTERNS.some((re) => re.test(t));
}

/**
 * Prefer concrete physical / visual description over planner purpose.
 * Rejects meta strings.
 */
export function pickPhysicalAction(candidates: Array<string | undefined | null>): {
  action: string;
  wasMeta: boolean;
  sourceIndex: number;
} {
  for (let i = 0; i < candidates.length; i++) {
    const c = String(candidates[i] || "").trim();
    if (!c) continue;
    if (isPlannerMetaText(c)) continue;
    // Prefer strings that look like visible action / environment
    return { action: c, wasMeta: false, sourceIndex: i };
  }
  // All meta or empty — return first non-empty for repair downstream
  for (let i = 0; i < candidates.length; i++) {
    const c = String(candidates[i] || "").trim();
    if (c) return { action: c, wasMeta: true, sourceIndex: i };
  }
  return { action: "", wasMeta: true, sourceIndex: -1 };
}

/**
 * Repair meta action into a usable physical blocking line without inventing story.
 * Uses camera + environment when available; never reintroduces "Host presents…".
 */
export function repairPhysicalAction(params: {
  metaOrEmpty: string;
  cameraDirection?: string;
  environment?: string;
  sceneIndex?: number;
  contentFormat?: string | null;
}): string {
  const cam = String(params.cameraDirection || "").trim() || "Medium cinematic framing";
  const env = String(params.environment || "").trim();
  const format = String(params.contentFormat || "").toLowerCase();
  const faceless = format === "faceless";
  const subject = faceless
    ? "Primary visual subject / product / environment"
    : "On-camera subject";
  const envBit = env ? ` in ${env}` : "";
  return `${subject} performs a clear, continuous physical action${envBit}. Camera: ${cam}. Natural body motion, motivated gestures, hold readable end pose. No text overlays.`;
}

export function resolveDirectorSceneScript(params: {
  scene?: any;
  beat?: any;
  shot?: any;
  environment?: string;
  contentFormat?: string | null;
  sceneIndexZeroBased?: number;
}): DirectorSceneScript {
  const scene = params.scene || {};
  const beat = params.beat || {};
  const shot = params.shot || {};

  const spoken = String(
    scene.spokenLines ||
      scene.scriptSnippet ||
      beat.spokenLines ||
      shot.dialogue ||
      shot.narration ||
      ""
  ).trim();

  const onScreen = String(
    scene.onScreenText || beat.onScreenText || shot.onScreenText || ""
  ).trim();

  // Physical action candidates — NEVER use spoken lines / onScreen as visual action
  const picked = pickPhysicalAction([
    scene.physicalAction,
    shot.physicalAction,
    shot.motion?.beginState,
    scene.startState,
    scene.visualDescription,
    shot.environment,
    scene.environmentAction,
    // subjectAction / primaryChange / purpose last — often planner meta
    scene.action,
    scene.primaryChange,
    shot.subjectAction,
    shot.subjectMovement,
    scene.purpose,
    beat.purpose,
  ]);

  let physicalAction = picked.action;
  let repaired = false;
  let wasMeta = picked.wasMeta;
  let source: DirectorSceneScript["source"] = picked.sourceIndex >= 0 ? "scene" : "empty";

  if (!physicalAction || wasMeta) {
    physicalAction = repairPhysicalAction({
      metaOrEmpty: physicalAction,
      cameraDirection: scene.cameraDirection || shot.camera?.shotType,
      environment:
        params.environment ||
        scene.environment ||
        shot.environment ||
        scene.visualDescription,
      sceneIndex: params.sceneIndexZeroBased,
      contentFormat: params.contentFormat,
    });
    repaired = true;
    wasMeta = true;
    source = "repaired";
  }

  // If spoken looks like planner meta, clear it (do not feed into audio as fake script)
  const spokenClean = isPlannerMetaText(spoken) && spoken.length < 40 ? "" : spoken;

  return {
    physicalAction,
    spokenLines: spokenClean,
    onScreenText: onScreen,
    repaired,
    wasMeta,
    source,
  };
}

/**
 * Merge Spec structural storyboard with LLM brief spoken authority.
 * Spec owns shot ids / camera / continuity; brief owns spokenLines when substantive.
 */
export function mergeSpecStoryboardWithBriefScript(params: {
  specStoryboard?: any[] | null;
  briefStoryboard?: any[] | null;
  briefBeats?: any[] | null;
  hook?: string;
}): any[] {
  const specSb = Array.isArray(params.specStoryboard) ? params.specStoryboard : [];
  const briefSb = Array.isArray(params.briefStoryboard) ? params.briefStoryboard : [];
  const beats = Array.isArray(params.briefBeats) ? params.briefBeats : [];
  if (specSb.length === 0) {
    return briefSb.length > 0 ? briefSb : [];
  }

  return specSb.map((panel, i) => {
    const briefPanel = briefSb[i] || briefSb.find((b) => Number(b.scene) === Number(panel.scene));
    const beat = beats[i];
    const briefSpoken = String(
      briefPanel?.spokenLines || briefPanel?.scriptSnippet || beat?.spokenLines || ""
    ).trim();
    const specSpoken = String(panel.spokenLines || panel.scriptSnippet || "").trim();
    // Prefer substantive brief spoken over thin Spec template
    const spoken =
      briefSpoken.length >= 12 && !isPlannerMetaText(briefSpoken)
        ? briefSpoken
        : briefSpoken.length > specSpoken.length
          ? briefSpoken
          : specSpoken || (i === 0 ? String(params.hook || "").trim() : "");

    const briefOnScreen = String(briefPanel?.onScreenText || beat?.onScreenText || "").trim();
    const director = resolveDirectorSceneScript({
      scene: {
        ...panel,
        spokenLines: spoken,
        onScreenText: briefOnScreen || panel.onScreenText,
        visualDescription:
          panel.visualDescription || briefPanel?.visualDescription || beat?.cameraDirection,
        physicalAction: panel.physicalAction || briefPanel?.physicalAction,
        primaryChange: panel.primaryChange,
        action: panel.action,
        startState: panel.startState || briefPanel?.startState,
        cameraDirection: panel.cameraDirection || briefPanel?.cameraDirection || beat?.cameraDirection,
      },
      beat,
      sceneIndexZeroBased: i,
    });

    return {
      ...panel,
      spokenLines: spoken || director.spokenLines,
      scriptSnippet: spoken || director.spokenLines,
      onScreenText: briefOnScreen || panel.onScreenText || director.onScreenText,
      physicalAction: director.physicalAction,
      // Keep Spec camera/continuity; replace meta primaryChange with physical action for downstream
      primaryChange: director.wasMeta ? director.physicalAction : panel.primaryChange || director.physicalAction,
      action: director.physicalAction,
      visualDescription:
        !isPlannerMetaText(panel.visualDescription)
          ? panel.visualDescription
          : director.physicalAction,
      directorScript: {
        physicalAction: director.physicalAction,
        spokenLines: spoken || director.spokenLines,
        onScreenText: briefOnScreen || panel.onScreenText || "",
        repaired: director.repaired,
      },
    };
  });
}

export function mergeSpecBeatsWithBriefBeats(params: {
  specBeats?: any[] | null;
  briefBeats?: any[] | null;
  hook?: string;
}): any[] {
  const specBeats = Array.isArray(params.specBeats) ? params.specBeats : [];
  const briefBeats = Array.isArray(params.briefBeats) ? params.briefBeats : [];
  if (specBeats.length === 0) return briefBeats;
  if (briefBeats.length === 0) return specBeats;

  return specBeats.map((sb, i) => {
    const bb = briefBeats[i] || {};
    const briefSpoken = String(bb.spokenLines || "").trim();
    const specSpoken = String(sb.spokenLines || "").trim();
    const spoken =
      briefSpoken.length >= 12 && !isPlannerMetaText(briefSpoken)
        ? briefSpoken
        : briefSpoken || specSpoken || (i === 0 ? String(params.hook || "") : "");
    return {
      ...sb,
      ...bb,
      // Spec timing/camera can win when present
      timecode: sb.timecode || bb.timecode,
      cameraDirection: sb.cameraDirection || bb.cameraDirection,
      valueJob: sb.valueJob || bb.valueJob,
      spokenLines: spoken,
      onScreenText: bb.onScreenText || sb.onScreenText,
      startState: bb.startState || sb.startState,
      endState: bb.endState || sb.endState,
    };
  });
}

/** Visual-prompt law: speech is performance audio only — never draw words. */
export function directorVisualSpeechLaw(spokenLines?: string): string {
  const spoken = String(spokenLines || "").trim();
  if (!spoken) {
    return "AUDIO: No spoken performance required for this shot. Diegetic ambience only. NEVER render text, letters, captions, or subtitles.";
  }
  return [
    "AUDIO / PERFORMANCE ONLY (do NOT draw as text):",
    `The talent's spoken performance intent is: ${spoken.replace(/"/g, "'")}`,
    "Animate natural lip/body performance if on-camera speech. NEVER burn words, captions, titles, or dialogue onto the frame.",
  ].join("\n");
}

/** Pre-I2V gate: require usable physical action. */
export function assertDirectorScriptReadyForMotion(script: DirectorSceneScript, sceneLabel: string): void {
  if (!script.physicalAction || script.physicalAction.trim().length < 16) {
    throw new Error(
      `Director Script Gate: ${sceneLabel} has no usable physicalAction before I2V spend`
    );
  }
  if (/host presents key/i.test(script.physicalAction)) {
    throw new Error(
      `Director Script Gate: ${sceneLabel} still contains banned fallback action — refuse I2V`
    );
  }
}
