import type { ProductionGrammar } from "./types";

export const travelGrammar: ProductionGrammar = {
  id: "travel",
  label: "Travel",
  description: "Place-forward coverage, atmosphere, journey pacing",
  narrativeFunctions: ["establishing", "hook", "context", "montage", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["aerial", "establishing", "wide", "medium", "insert"],
    preferredMovements: ["tracking", "crane", "pan", "handheld"],
    requireEstablishing: true,
    requireInserts: true,
    dialogueCoverage: false,
    brollDensity: "high",
  },
  audioBias: { narration: true, dialogue: false, music: true, soundDesign: true },
  pacingBias: "variable",
  visualNotes: ["location identity", "golden-hour bias when fitting"],
  editorialNotes: ["journey montage"],
  tags: ["travel", "lifestyle"],
};

export default travelGrammar;
