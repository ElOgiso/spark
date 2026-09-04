import type { ProductionGrammar } from "./types";

export const documentaryGrammar: ProductionGrammar = {
  id: "documentary",
  label: "Documentary",
  description: "Factual structure with interview, B-roll, narration, evidence",
  narrativeFunctions: ["hook", "context", "proof", "example", "interview", "broll", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["establishing", "medium", "closeup", "insert", "wide", "aerial"],
    preferredMovements: ["static", "handheld", "tracking", "pan"],
    requireEstablishing: true,
    requireInserts: true,
    dialogueCoverage: true,
    brollDensity: "high",
  },
  audioBias: { narration: true, dialogue: true, music: true, soundDesign: true },
  pacingBias: "measured",
  visualNotes: ["evidence-forward", "location coverage", "archival/media integration"],
  editorialNotes: ["A-roll/B-roll intercut", "narration bridges"],
  tags: ["factual", "research", "cinematic"],
};

export default documentaryGrammar;
