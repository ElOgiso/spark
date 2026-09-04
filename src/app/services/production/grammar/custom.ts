import type { ProductionGrammar } from "./types";

export const customGrammar: ProductionGrammar = {
  id: "custom",
  label: "Custom",
  description: "Flexible grammar composed from tags and creative intent",
  narrativeFunctions: ["hook", "context", "proof", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["medium", "closeup", "wide", "insert"],
    preferredMovements: ["static", "push_in"],
    requireEstablishing: false,
    requireInserts: false,
    dialogueCoverage: false,
    brollDensity: "low",
  },
  audioBias: { narration: true, dialogue: false, music: true, soundDesign: false },
  pacingBias: "measured",
  visualNotes: ["follow creative director inference"],
  editorialNotes: ["compose from tags"],
  tags: ["custom"],
};

export default customGrammar;
