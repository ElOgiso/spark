import type { ProductionGrammar } from "./types";

export const productDemoGrammar: ProductionGrammar = {
  id: "product_demo",
  label: "Product Demo",
  description: "Feature clarity, hands-on demonstration, benefit proof",
  narrativeFunctions: ["hook", "product", "example", "proof", "cta"],
  coverage: {
    preferredShotTypes: ["macro", "closeup", "medium", "insert", "wide"],
    preferredMovements: ["static", "orbit", "push_in"],
    requireEstablishing: false,
    requireInserts: true,
    dialogueCoverage: false,
    brollDensity: "medium",
  },
  audioBias: { narration: true, dialogue: false, music: true, soundDesign: true },
  pacingBias: "compressed",
  visualNotes: ["feature readability", "hand continuity", "product hero angles"],
  editorialNotes: ["show then tell"],
  tags: ["product", "demo"],
};

export default productDemoGrammar;
