import type { ProductionGrammar } from "./types";

export const newsExplainerGrammar: ProductionGrammar = {
  id: "news_explainer",
  label: "News / Explainer",
  description: "Current, clear, evidence-led explainers",
  narrativeFunctions: ["hook", "context", "proof", "example", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["medium", "insert", "establishing", "closeup"],
    preferredMovements: ["static", "pan"],
    requireEstablishing: true,
    requireInserts: true,
    dialogueCoverage: false,
    brollDensity: "high",
  },
  audioBias: { narration: true, dialogue: false, music: false, soundDesign: true },
  pacingBias: "compressed",
  visualNotes: ["evidence clarity", "location/context plates"],
  editorialNotes: ["fact before flourish"],
  tags: ["news", "research"],
};

export default newsExplainerGrammar;
