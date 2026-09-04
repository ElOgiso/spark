import type { ProductionGrammar } from "./types";

export const musicVideoGrammar: ProductionGrammar = {
  id: "music_video",
  label: "Music Video",
  description: "Rhythm-led visuals, performance, stylized motion",
  narrativeFunctions: ["hook", "montage", "payoff"],
  coverage: {
    preferredShotTypes: ["wide", "medium", "closeup", "tracking", "aerial"],
    preferredMovements: ["tracking", "crane", "handheld", "orbit"],
    requireEstablishing: true,
    requireInserts: false,
    dialogueCoverage: false,
    brollDensity: "high",
  },
  audioBias: { narration: false, dialogue: false, music: true, soundDesign: true },
  pacingBias: "variable",
  visualNotes: ["beat-synced cuts", "stylized color", "performance staging"],
  editorialNotes: ["cut on beat", "montage density"],
  tags: ["music", "stylized"],
};

export default musicVideoGrammar;
