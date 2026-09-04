import type { ProductionGrammar } from "./types";

export const sportsGrammar: ProductionGrammar = {
  id: "sports",
  label: "Sports",
  description: "Action clarity, impact moments, kinetic coverage",
  narrativeFunctions: ["hook", "context", "proof", "montage", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["wide", "tracking", "closeup", "insert", "aerial"],
    preferredMovements: ["tracking", "handheld", "pan", "crane"],
    requireEstablishing: true,
    requireInserts: true,
    dialogueCoverage: false,
    brollDensity: "high",
  },
  audioBias: { narration: true, dialogue: false, music: true, soundDesign: true },
  pacingBias: "compressed",
  visualNotes: ["action readability", "impact framing"],
  editorialNotes: ["cut on impact"],
  tags: ["sports", "kinetic"],
};

export default sportsGrammar;
