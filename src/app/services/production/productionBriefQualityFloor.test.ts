import assert from "node:assert/strict";
import test from "node:test";
import { ProductionBriefService } from "./productionBriefService";
import { ModelRouter } from "../runtime/modelRouter";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import type { Brand, ViralSpark } from "../../domain/types";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as any).window = { dispatchEvent: () => true };
  return store;
}

test("ProductionBriefService.generateBrief succeeds with robust domain fallback even if LLM returns empty output", async () => {
  installMemoryLocalStorage();
  ProductionGenerationGuard.setEnabled(true);

  const brand: Brand = {
    id: "brand_test",
    name: "Nexus Media",
    tagline: "High Impact",
    niche: "AI Video",
    pillar: "Automation",
    status: "active",
    colors: { primary: "#000", secondary: "#fff", accent: "#f00" },
    socialLinks: {},
    website: "https://nexus.ai",
  };

  // Spark without viral spoken beats
  const spark: ViralSpark = {
    id: "spark_test_1",
    title: "How to Build Consistent AI Characters",
    hook: "Most creators cannot keep their character face consistent across shots.",
    views: "200k",
    velocity: "12k/day",
    platformFit: "YouTube Shorts",
    brandFitScore: 92,
    category: "hot",
    timeWindow: "7d",
    productionTime: "15m",
    whyNow: "Character consistency is exploding in 2026",
    angle: "Use character sheets before generating shots",
    spoken_beats: [], // Empty spoken beats!
  };

  // Mock ModelRouter to return unparseable or empty output
  const originalExecute = ModelRouter.executeCategoryRequest;
  ModelRouter.executeCategoryRequest = async () => {
    return "Here is some conversational text without valid JSON";
  };

  try {
    const brief = await ProductionBriefService.generateBrief({
      spark,
      brand,
      productionMode: "standard",
      targetDurationSec: 15,
    });

    assert.ok(brief, "Brief should be generated");
    assert.ok(brief.beats.length >= 3, "Should have at least 3 beats");
    assert.ok(brief.beats[0].spokenLines.length > 0, "Beats should have spoken lines");
    const totalWords = brief.beats.reduce((acc, b) => acc + b.spokenLines.split(/\s+/).filter(Boolean).length, 0);
    assert.ok(totalWords >= 30, `Total words (${totalWords}) should satisfy 30 word floor`);
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
  }
});

test("ProductionBriefService.generateBrief successfully parses JSON with markdown preamble and postamble", async () => {
  installMemoryLocalStorage();
  ProductionGenerationGuard.setEnabled(true);

  const brand: Brand = {
    id: "brand_test_2",
    name: "Nexus Media",
    tagline: "High Impact",
    niche: "AI Video",
    pillar: "Automation",
    status: "active",
    colors: { primary: "#000", secondary: "#fff", accent: "#f00" },
    socialLinks: {},
    website: "https://nexus.ai",
  };

  const spark: ViralSpark = {
    id: "spark_test_2",
    title: "How to Build Consistent AI Characters",
    hook: "Most creators cannot keep their character face consistent across shots.",
    views: "200k",
    velocity: "12k/day",
    platformFit: "YouTube Shorts",
    brandFitScore: 92,
    category: "hot",
    timeWindow: "7d",
    productionTime: "15m",
    whyNow: "Character consistency is exploding in 2026",
    angle: "Use character sheets before generating shots",
    spoken_beats: [],
  };

  const validJson = JSON.stringify({
    title: "How to Build Consistent AI Characters",
    productionMode: "standard",
    targetDurationSec: 15,
    hook: "Most creators cannot keep their character face consistent across shots.",
    beats: [
      {
        timecode: "[00:00-00:05]",
        valueJob: "hook",
        spokenLines: "Most creators cannot keep their character face consistent across shots. Here is the exact frame-locking system we use every single day.",
        onScreenText: "CHARACTER CONSISTENCY",
        cameraDirection: "Direct to lens",
        startState: "Host in frame",
        endState: "Host gestures",
        audio: "talent"
      },
      {
        timecode: "[00:05-00:10]",
        valueJob: "proof",
        spokenLines: "By locking your turnaround sheets first, every subsequent video model inherits the exact facial geometry and clothing palette without morphing.",
        onScreenText: "TURNAROUND SHEET",
        cameraDirection: "Close-up",
        startState: "Host gestures",
        endState: "Host points",
        audio: "talent"
      },
      {
        timecode: "[00:10-00:15]",
        valueJob: "cta",
        spokenLines: "Grab the character lock template in our bio and start producing cohesive multi-scene stories right now.",
        onScreenText: "GET TEMPLATE",
        cameraDirection: "Medium wide",
        startState: "Host points",
        endState: "Host smiles",
        audio: "talent"
      }
    ],
    spokenCta: "Grab the character lock template in our bio and start producing cohesive multi-scene stories right now.",
    onScreenCta: "GET TEMPLATE"
  });

  const originalExecute = ModelRouter.executeCategoryRequest;
  ModelRouter.executeCategoryRequest = async () => {
    return `Sure! Here is the compiled production brief for Nexus Media:\n\`\`\`json\n${validJson}\n\`\`\`\nHope this helps you build consistent AI video!`;
  };

  try {
    const brief = await ProductionBriefService.generateBrief({
      spark,
      brand,
      productionMode: "standard",
      targetDurationSec: 15,
    });

    assert.ok(brief, "Brief should be generated");
    assert.equal(brief.beats.length, 3);
    assert.ok(brief.beats[0].spokenLines.includes("frame-locking system"));
    assert.ok(brief.beats[1].spokenLines.includes("facial geometry"));
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
  }
});
