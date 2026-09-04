/**
 * Narrative planner — grammar-driven structure (not one universal beat recipe).
 * Output is structured data, not prose-only.
 */

import type { CreativeSpec, NarrativeSpec } from "../specification/productionSpec";
import type { NarrativeFunction } from "../specification/sceneSpec";
import type { ComposedGrammar } from "../grammar";
import type { ContentGenreId } from "../specification/productionSpec";

export interface NarrativeBeatPlan {
  index: number;
  narrativeFunction: NarrativeFunction;
  purpose: string;
  durationSec: number;
  spokenHint: string;
}

/** Genre-specific narrative skeletons — extensible without rewriting planner core */
const STRUCTURE_BY_GENRE: Record<string, NarrativeFunction[]> = {
  educational: ["problem", "context", "example", "proof", "payoff"],
  documentary: ["hook", "context", "interview", "proof", "broll", "payoff"],
  news_explainer: ["hook", "context", "proof", "payoff", "cta"],
  advertisement: ["hook", "problem", "product", "proof", "payoff", "cta"],
  product_demo: ["hook", "product", "example", "proof", "cta"],
  narrative_film: ["establishing", "hook", "confrontation", "payoff", "resolution"],
  animation: ["hook", "establishing", "confrontation", "payoff"],
  anime: ["hook", "establishing", "confrontation", "payoff"],
  comedy: ["hook", "context", "payoff", "cta"],
  music_video: ["hook", "montage", "payoff"],
  travel: ["establishing", "hook", "montage", "payoff", "cta"],
  sports: ["hook", "context", "montage", "payoff", "cta"],
  social: ["hook", "problem", "context", "payoff", "cta"],
  custom: ["hook", "context", "payoff"],
};

export function structureForGenre(genre: ContentGenreId | string, grammar: ComposedGrammar): NarrativeFunction[] {
  const fromMap = STRUCTURE_BY_GENRE[genre];
  if (fromMap?.length) return [...fromMap];
  if (grammar.narrativeFunctions?.length) return [...grammar.narrativeFunctions];
  return ["hook", "context", "payoff"];
}

export function planNarrative(params: {
  idea: string;
  creative: CreativeSpec;
  grammar: ComposedGrammar;
  targetDurationSec: number;
}): { narrative: NarrativeSpec; beats: NarrativeBeatPlan[]; structureId: string } {
  const { idea, creative, grammar, targetDurationSec } = params;
  const selectedBase = structureForGenre(creative.genre, grammar);

  // Scale beat count to duration without inventing unrelated acts
  let selected = [...selectedBase];
  const idealCount = Math.max(
    3,
    Math.min(selectedBase.length, Math.max(3, Math.round(targetDurationSec / 20)))
  );
  if (selected.length > idealCount) {
    // Keep first, middle-ish, last
    const keep = new Set<number>([0, selected.length - 1]);
    while (keep.size < idealCount) {
      keep.add(Math.floor((keep.size * selected.length) / idealCount));
    }
    selected = selected.filter((_, i) => keep.has(i));
  }

  // Do NOT force CTA onto narrative film / animation / music video
  const ctaGenres = new Set([
    "social",
    "educational",
    "advertisement",
    "product_demo",
    "documentary",
    "news_explainer",
    "comedy",
  ]);
  if (!ctaGenres.has(creative.genre)) {
    selected = selected.filter((fn) => fn !== "cta");
  }

  const base = Math.max(3, Math.floor(targetDurationSec / Math.max(1, selected.length)));
  let remaining = targetDurationSec;
  const beats: NarrativeBeatPlan[] = selected.map((fn, index) => {
    const durationSec = index === selected.length - 1 ? Math.max(3, remaining) : base;
    remaining -= durationSec;
    return {
      index,
      narrativeFunction: fn,
      purpose: purposeFor(fn, idea, creative.genre),
      durationSec,
      spokenHint: spokenFor(fn, idea, creative),
    };
  });

  const narrative: NarrativeSpec = {
    logline: idea.trim().slice(0, 220),
    hook: beats[0]?.spokenHint || idea,
    acts: [
      {
        id: "act_primary",
        name: `${creative.genre} structure`,
        purpose: selected.join(" → "),
        sceneIds: [],
      },
    ],
    scriptOutline: beats.map((b) => `${b.narrativeFunction}: ${b.purpose}`).join("\n"),
    ctaSpoken: selected.includes("cta") && creative.requiresNarration ? "Follow for more." : undefined,
    ctaOnScreen: selected.includes("cta") ? "Follow" : undefined,
    caption: idea.trim().slice(0, 180),
    whyThisWorks: creative.rationale.slice(0, 3).join(" "),
  };

  return {
    narrative,
    beats,
    structureId: `${creative.genre}:${selected.join("+")}`,
  };
}

function purposeFor(fn: NarrativeFunction, idea: string, genre: string): string {
  switch (fn) {
    case "hook":
      return genre === "advertisement" || genre === "product_demo"
        ? `Capture attention for: ${idea}`
        : `Open with a strong hook about: ${idea}`;
    case "problem":
      return "Establish the problem, desire, or tension";
    case "context":
      return "Provide necessary context / setup";
    case "proof":
      return genre === "documentary" ? "Present evidence / investigation findings" : "Show evidence or social proof";
    case "example":
      return "Demonstrate with a concrete example / explanation beat";
    case "myth_bust":
      return "Challenge a common misconception";
    case "payoff":
      return "Deliver the key reveal / payoff";
    case "cta":
      return "Close with a clear call to action";
    case "interview":
      return "Interview / testimony coverage";
    case "broll":
      return "Supporting B-roll / atmospheric coverage";
    case "product":
      return "Hero product demonstration / benefit";
    case "establishing":
      return "Establish world, location, and character geography";
    case "confrontation":
      return "Escalate conflict / obstacle";
    case "resolution":
      return "Resolve story objective";
    case "montage":
      return "Montage progression / rhythmic coverage";
    default:
      return `Advance ${genre} narrative via ${fn}`;
  }
}

function spokenFor(fn: NarrativeFunction, idea: string, creative: CreativeSpec): string {
  if (!creative.requiresNarration && !creative.requiresDialogue) return "";
  const cleaned = idea.replace(/^make (me )?(a )?/i, "").slice(0, 120);
  switch (fn) {
    case "hook":
      return creative.genre === "narrative_film"
        ? `In a world of ${cleaned}…`
        : `What if ${cleaned}?`;
    case "cta":
      return "If this helped, follow for the next breakdown.";
    case "payoff":
      return creative.genre === "narrative_film" ? "The discovery changes everything." : "Here's the key takeaway.";
    case "product":
      return "See it in action.";
    default:
      return "";
  }
}
