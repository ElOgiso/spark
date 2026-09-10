/**
 * Production Intent Interpreter
 *
 * Distinguishes user intent scope (CREATOR vs SERIES vs EPISODE vs SCENE),
 * infers content type, genre, medium, cadence, and recurring character references,
 * and translates natural language into structured production state.
 */

import type { Brand, Production, ProductionSeries, StoryCanon } from "../../../domain/types";
import { ModelRouter } from "../../runtime/modelRouter";

export type ProductionScope = "creator" | "series" | "episode" | "scene";

export type ProductionType =
  | "serialized_narrative"
  | "episodic_show"
  | "standalone"
  | "talking_head"
  | "music_video"
  | "documentary";

export interface StructuredProductionIntent {
  rawPrompt: string;
  intentType:
    | "configure_series"
    | "create_episode"
    | "create_standalone"
    | "scene_directive"
    | "creator_preference"
    | "general_query";
  intent?:
    | "configure_series"
    | "create_episode"
    | "create_standalone"
    | "scene_directive"
    | "creator_preference"
    | "general_query";
  scope: ProductionScope;
  productionType: ProductionType;
  medium?: "animation" | "live_action" | "mixed_media" | "graphic_novel";
  genre?: string;
  cadence?: "weekly" | "daily" | "biweekly" | "monthly" | "standalone";
  series?: {
    title?: string;
    recurringCharacters?: string[];
    universeNotes?: string;
    episodeTarget?: number;
  };
  seriesConfig?: Partial<ProductionSeries>;
  episode?: {
    episodeNumber?: number;
    focus?: string;
  };
  episodeDirective?: {
    episodeNumber?: number;
    title?: string;
    hook?: string;
    instructions?: string;
  };
  sceneDirective?: {
    targetScene?: number;
    sceneIndex?: number;
    instruction?: string;
    visualOverride?: string;
    audioOverride?: string;
    lightingOverride?: string;
    actionOverride?: string;
  };
  creatorPreferenceCandidate?: {
    aspectRatio?: string;
    targetDurationSec?: number;
    visualGenre?: string;
    preferredVideoProvider?: string;
    contentFormat?: string;
  };
  creatorPreference?: {
    formatPatch?: Partial<import("../../../domain/types").ProductionFormatSettings>;
    styleDirective?: string;
  };
  requiresConfirmation: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * Deterministic rules-based intent extractor.
 * High-accuracy fallback and baseline for testing and offline execution.
 */
export function parseIntentDeterministically(
  prompt: string,
  context?: {
    brand?: Brand | null;
    activeSeries?: ProductionSeries | null;
    currentProduction?: Production | null;
  }
): StructuredProductionIntent {
  const clean = prompt.trim();
  const lower = clean.toLowerCase();

  // 1. Scene / Local Shot Directive: e.g. "For this scene...", "Make the villain wear red", "in this scene", "make the palace scene at night"
  const isSceneOrLocalShot =
    /\b(for this (scene|shot|episode)|in this (scene|shot)|for scene \d+|make the .+ scene|this episode should look like)\b/i.test(
      lower
    ) ||
    (/\b(scene|shot)\b/i.test(lower) && /\b(night|day|red|blue|dark|bright|rain|sunset|wider|close up)\b/i.test(lower));

  if (isSceneOrLocalShot && !/\bfrom now on\b/i.test(lower)) {
    const sceneMatch = lower.match(/\bscene\s*(\d+)\b/i);
    const targetScene = sceneMatch ? parseInt(sceneMatch[1], 10) : undefined;
    return {
      rawPrompt: clean,
      intentType: "scene_directive",
      intent: "scene_directive",
      scope: targetScene ? "scene" : "episode",
      productionType: context?.activeSeries?.productionType || "standalone",
      sceneDirective: {
        targetScene,
        sceneIndex: targetScene !== undefined ? targetScene - 1 : 0,
        instruction: clean,
        visualOverride: clean,
        lightingOverride: lower.includes("night") ? "night" : lower.includes("dark") ? "dark" : undefined,
        actionOverride: clean,
      },
      requiresConfirmation: false,
      confidence: 0.95,
      reasoning: "User is specifying local styling or action for a specific scene/episode, not altering global creator settings.",
    };
  }

  // 2. Global Creator / Channel Preference: e.g. "From now on...", "always use...", "default style", "for all my future videos"
  const isCreatorPreference =
    /\b(from now on|always use|set my default|for all my future|global preference|my channel style)\b/i.test(lower) ||
    (/\bprefer\b/i.test(lower) && /\b(always|default|across all)\b/i.test(lower));

  if (isCreatorPreference) {
    const aspectMode = lower.includes("landscape") || lower.includes("16:9") ? "landscape" : lower.includes("portrait") || lower.includes("9:16") ? "portrait" : undefined;
    return {
      rawPrompt: clean,
      intentType: "creator_preference",
      intent: "creator_preference",
      scope: "creator",
      productionType: "talking_head",
      creatorPreferenceCandidate: {
        visualGenre: lower.includes("anime") ? "anime" : lower.includes("cinematic") ? "cinematic" : undefined,
        aspectRatio: aspectMode === "landscape" ? "16:9" : aspectMode === "portrait" ? "9:16" : undefined,
      },
      creatorPreference: {
        formatPatch: aspectMode ? { aspectMode } : undefined,
        styleDirective: clean,
      },
      requiresConfirmation: true,
      confidence: 0.9,
      reasoning: "User is requesting a permanent change to creator/brand-level preferences.",
    };
  }

  // 3. Episode Continuation: e.g. "Let's make Episode 1", "Episode 2", "Let's continue the story", "next episode"
  const isEpisodeCreation =
    /\b(episode\s*(\d+)|make episode|next episode|continue( the story)?|let's make episode)\b/i.test(lower);

  if (isEpisodeCreation) {
    const epMatch = lower.match(/episode\s*(\d+)/i);
    const epNum = epMatch
      ? parseInt(epMatch[1], 10)
      : context?.activeSeries
      ? context.activeSeries.currentEpisode
      : 1;

    return {
      rawPrompt: clean,
      intentType: "create_episode",
      intent: "create_episode",
      scope: "episode",
      productionType: context?.activeSeries?.productionType || "serialized_narrative",
      episode: {
        episodeNumber: epNum,
        focus: clean,
      },
      episodeDirective: {
        episodeNumber: epNum,
        title: context?.activeSeries ? `${context.activeSeries.title} - Episode ${epNum}` : `Episode ${epNum}`,
        hook: clean,
        instructions: clean,
      },
      series: context?.activeSeries ? { title: context.activeSeries.title } : undefined,
      requiresConfirmation: false,
      confidence: 0.95,
      reasoning: `User requested episode creation (Episode ${epNum}) within series storyline.`,
    };
  }

  // 4. Series Configuration: e.g. "I want to make a weekly animated series...", "new show", "serialized story"
  const isSeriesIntent =
    /\b(series|show|weekly episode|season|serialized|continue the same story from episode to episode)\b/i.test(lower);

  if (isSeriesIntent) {
    let medium: StructuredProductionIntent["medium"] = "live_action";
    if (/\b(animated|animation|anime|cartoon|manga)\b/i.test(lower)) medium = "animation";
    else if (/\b(comic|graphic novel)\b/i.test(lower)) medium = "graphic_novel";

    let genre = "narrative";
    if (/\b(wuxia|martial arts|kung fu)\b/i.test(lower)) genre = "wuxia";
    else if (/\b(sci-?fi|cyberpunk|space|futuristic)\b/i.test(lower)) genre = "sci-fi";
    else if (/\b(comedy|sitcom|humor)\b/i.test(lower)) genre = "comedy";
    else if (/\b(documentary|docuseries)\b/i.test(lower)) genre = "documentary";

    let cadence: StructuredProductionIntent["cadence"] = "weekly";
    if (/\bdaily\b/i.test(lower)) cadence = "daily";
    else if (/\bbi-?weekly\b/i.test(lower)) cadence = "biweekly";
    else if (/\bmonthly\b/i.test(lower)) cadence = "monthly";

    // Extract character name if present e.g. "named OZ", "character named OZ", "martial artist named OZ"
    const charMatch = clean.match(/(?:main character|protagonist|hero|character|martial artist|named)\s+(?:is\s+|named\s+)?["']?([A-Z][a-zA-Z0-9_-]*)/i);
    const recurringCharacters = charMatch ? [charMatch[1]] : [];

    return {
      rawPrompt: clean,
      intentType: "configure_series",
      intent: "configure_series",
      scope: "series",
      productionType: "serialized_narrative",
      medium,
      genre,
      cadence,
      series: {
        title: `${genre.toUpperCase()} Series`,
        recurringCharacters,
        universeNotes: clean,
      },
      seriesConfig: {
        title: `${genre.toUpperCase()} Series`,
        format: "serialized_narrative",
        medium,
        genre,
        releaseCadence: cadence,
        recurringCharacters,
        logline: clean,
      },
      requiresConfirmation: false,
      confidence: 0.95,
      reasoning: `Identified serialized series intent with ${medium} medium, ${genre} genre, and ${cadence} release cadence.`,
    };
  }

  // 5. Standalone video creation: e.g. "Make me a 30-second cinematic video of a woman walking through a desert"
  const isStandaloneCreation =
    /\b(make|create|generate)\b/i.test(lower) &&
    /\b(video|clip|short|reel|film|scene)\b/i.test(lower);

  if (isStandaloneCreation) {
    let productionType: ProductionType = "standalone";
    if (/\b(music video|song)\b/i.test(lower)) productionType = "music_video";
    else if (/\b(documentary)\b/i.test(lower)) productionType = "documentary";
    else if (/\b(host|talking head|explainer|presenter)\b/i.test(lower)) productionType = "talking_head";

    return {
      rawPrompt: clean,
      intentType: "create_standalone",
      intent: "create_standalone",
      scope: "episode",
      productionType,
      cadence: "standalone",
      requiresConfirmation: false,
      confidence: 0.9,
      reasoning: "User requested a single, standalone production without serialized series or persistent universe requirements.",
    };
  }

  // Default: general query or unrecognized command
  return {
    rawPrompt: clean,
    intentType: "general_query",
    intent: "general_query",
    scope: "creator",
    productionType: "standalone",
    requiresConfirmation: false,
    confidence: 0.5,
    reasoning: "General conversational input or query.",
  };
}

export type ProductionIntentResult = StructuredProductionIntent;

/**
 * Interprets natural language using frontier AI reasoning with deterministic fallback.
 */
export async function interpretProductionIntent(
  promptOrParams:
    | string
    | {
        prompt: string;
        brand?: Brand | null;
        activeSeries?: ProductionSeries | null;
        currentProduction?: Production | null;
      },
  activeSeriesParam?: ProductionSeries | null,
  options?: {
    brand?: Brand | null;
    activeProductionId?: string;
    currentProduction?: Production | null;
  }
): Promise<StructuredProductionIntent> {
  let prompt: string;
  let brand: Brand | null | undefined;
  let activeSeries: ProductionSeries | null | undefined;
  let currentProduction: Production | null | undefined;

  if (typeof promptOrParams === "string") {
    prompt = promptOrParams;
    activeSeries = activeSeriesParam;
    brand = options?.brand;
    currentProduction = options?.currentProduction;
  } else {
    prompt = promptOrParams.prompt;
    brand = promptOrParams.brand;
    activeSeries = promptOrParams.activeSeries;
    currentProduction = promptOrParams.currentProduction;
  }

  // Run deterministic parser first as fast, robust baseline
  const baseline = parseIntentDeterministically(prompt, { brand, activeSeries, currentProduction });

  // If high confidence or offline, return baseline immediately
  if (baseline.confidence >= 0.9) {
    return baseline;
  }

  try {
    const aiSystemPrompt = `You are SPARK's Production Intelligence Boundary Interpreter.
Analyze the user's natural language media request and return a JSON object with this exact shape:
{
  "intentType": "configure_series" | "create_episode" | "create_standalone" | "scene_directive" | "creator_preference" | "general_query",
  "scope": "creator" | "series" | "episode" | "scene",
  "productionType": "serialized_narrative" | "episodic_show" | "standalone" | "talking_head" | "music_video" | "documentary",
  "medium": "animation" | "live_action" | "mixed_media" | "graphic_novel",
  "genre": string,
  "cadence": "weekly" | "daily" | "biweekly" | "monthly" | "standalone",
  "recurringCharacters": string[],
  "reasoning": string
}

IMPORTANT RULES:
1. "For this episode, make the villain wear red" -> scope "scene" or "episode", NEVER "creator".
2. "From now on, use my preferred visual style" -> scope "creator".
3. Standalone video requests -> intentType "create_standalone", do NOT create seasons or series.
4. Serialized series ("weekly animated wuxia series...") -> intentType "configure_series", scope "series".
Respond ONLY with raw JSON.`;

    const aiRes = await ModelRouter.executeCategoryRequest("production", {
      prompt: `${aiSystemPrompt}\n\nUser Input: "${prompt}"`,
      capability: "Chat",
    });

    if (aiRes && typeof aiRes === "string") {
      const match = aiRes.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          rawPrompt: prompt,
          intentType: parsed.intentType || baseline.intentType,
          scope: parsed.scope || baseline.scope,
          productionType: parsed.productionType || baseline.productionType,
          medium: parsed.medium || baseline.medium,
          genre: parsed.genre || baseline.genre,
          cadence: parsed.cadence || baseline.cadence,
          series: {
            title: parsed.genre ? `${parsed.genre} Series` : undefined,
            recurringCharacters: parsed.recurringCharacters || baseline.series?.recurringCharacters,
          },
          requiresConfirmation: parsed.scope === "creator",
          confidence: 0.95,
          reasoning: parsed.reasoning || "Frontier AI intent analysis.",
        };
      }
    }
  } catch (err) {
    // Fall back cleanly to deterministic parser
  }

  return baseline;
}
