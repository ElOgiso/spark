/**
 * Narrative planner — maps creative intent + grammar into act/scene narrative skeleton.
 */

import type { CreativeSpec, NarrativeSpec } from "../specification/productionSpec";
import type { NarrativeFunction } from "../specification/sceneSpec";
import type { ComposedGrammar } from "../grammar";

export interface NarrativeBeatPlan {
  index: number;
  narrativeFunction: NarrativeFunction;
  purpose: string;
  durationSec: number;
  spokenHint: string;
}

export function planNarrative(params: {
  idea: string;
  creative: CreativeSpec;
  grammar: ComposedGrammar;
  targetDurationSec: number;
}): { narrative: NarrativeSpec; beats: NarrativeBeatPlan[] } {
  const { idea, creative, grammar, targetDurationSec } = params;
  const functions = (grammar.narrativeFunctions.length
    ? grammar.narrativeFunctions
    : ["hook", "context", "proof", "payoff", "cta"]) as NarrativeFunction[];

  const sceneCount = Math.max(3, Math.min(functions.length, creative.estimatedSceneCount));
  const selected = functions.slice(0, sceneCount);
  // Ensure hook + payoff/cta present
  if (!selected.includes("hook")) selected[0] = "hook";
  if (!selected.includes("cta") && !selected.includes("payoff")) {
    selected[selected.length - 1] = "cta";
  }

  const base = Math.max(3, Math.floor(targetDurationSec / selected.length));
  let remaining = targetDurationSec;
  const beats: NarrativeBeatPlan[] = selected.map((fn, index) => {
    const durationSec = index === selected.length - 1 ? Math.max(3, remaining) : base;
    remaining -= durationSec;
    return {
      index,
      narrativeFunction: fn,
      purpose: purposeFor(fn, idea),
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
        name: "Primary narrative",
        purpose: creative.narrativeStructure,
        sceneIds: [], // filled by production planner
      },
    ],
    scriptOutline: beats.map((b) => `${b.narrativeFunction}: ${b.purpose}`).join("\n"),
    ctaSpoken: creative.requiresNarration ? "Follow for more." : undefined,
    ctaOnScreen: "Follow",
    caption: idea.trim().slice(0, 180),
    whyThisWorks: creative.rationale.slice(0, 3).join(" "),
  };

  return { narrative, beats };
}

function purposeFor(fn: NarrativeFunction, idea: string): string {
  switch (fn) {
    case "hook":
      return `Open with a strong hook about: ${idea}`;
    case "problem":
      return "Establish the problem or tension";
    case "context":
      return "Provide necessary context";
    case "proof":
      return "Show evidence or proof";
    case "example":
      return "Demonstrate with a concrete example";
    case "myth_bust":
      return "Challenge a common misconception";
    case "payoff":
      return "Deliver the key payoff";
    case "cta":
      return "Close with a clear call to action";
    case "interview":
      return "Interview / testimony coverage";
    case "broll":
      return "Supporting B-roll coverage";
    case "product":
      return "Hero product demonstration";
    case "establishing":
      return "Establish world and location";
    default:
      return `Advance story via ${fn}`;
  }
}

function spokenFor(fn: NarrativeFunction, idea: string, creative: CreativeSpec): string {
  if (!creative.requiresNarration && !creative.requiresDialogue) return "";
  switch (fn) {
    case "hook":
      return `What if ${idea.replace(/^make (me )?(a )?/i, "").slice(0, 120)}?`;
    case "cta":
      return "If this helped, follow for the next breakdown.";
    case "payoff":
      return "Here's the key takeaway.";
    default:
      return `Continuing the ${creative.genre.replace(/_/g, " ")} thread.`;
  }
}
