import type { ProductionGrammar } from "./types";

export const socialGrammar: ProductionGrammar = {
  id: "social",
  label: "Social / Short-form",
  description: "Strong opening, compressed pacing, mobile framing",
  narrativeFunctions: ["hook", "problem", "context", "proof", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["closeup", "medium", "insert", "wide"],
    preferredMovements: ["static", "push_in", "handheld"],
    requireEstablishing: false,
    requireInserts: true,
    dialogueCoverage: false,
    brollDensity: "low",
  },
  audioBias: { narration: true, dialogue: false, music: true, soundDesign: false },
  pacingBias: "compressed",
  visualNotes: ["mobile framing", "rapid visual changes when needed"],
  editorialNotes: ["hook in first 1–2s", "retention pattern"],
  tags: ["short-form", "viral", "vertical"],
};

export default socialGrammar;
