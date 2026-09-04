import type { ProductionGrammar } from "./types";

export const educationalGrammar: ProductionGrammar = {
  id: "educational",
  label: "Educational",
  description: "Concept progression, visual explanations, examples",
  narrativeFunctions: ["hook", "context", "example", "myth_bust", "proof", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["medium", "insert", "closeup", "wide"],
    preferredMovements: ["static", "push_in", "pan"],
    requireEstablishing: false,
    requireInserts: true,
    dialogueCoverage: false,
    brollDensity: "medium",
  },
  audioBias: { narration: true, dialogue: false, music: true, soundDesign: false },
  pacingBias: "measured",
  visualNotes: ["diagram-friendly inserts", "clear subject focus"],
  editorialNotes: ["concept → example → retention"],
  tags: ["explain", "tutorial"],
};

export default educationalGrammar;
