import assert from "node:assert/strict";
import test from "node:test";
import { compileDeterministicBrief, formatResearchContextBlock } from "./productionBriefService";
import type { Brand, ViralSpark, StructuredResearchContext } from "../../domain/types";

test("formatResearchContextBlock includes openingLine, spokenBeats, visualActions, and ctaLine in prompt block", () => {
  const research: StructuredResearchContext = {
    sourceName: "Viral AI Case Study",
    platform: "YouTube",
    openingLine: "99% of creators generate AI video completely backwards.",
    spokenBeats: [
      "99% of creators generate AI video completely backwards.",
      "They prompt for a single long video instead of locking character sheets.",
    ],
    visualActions: [
      "Creator sits at dark minimalist desk pointing at lens",
      "Camera pans across split-screen",
    ],
    ctaLine: "Check the blueprint link below.",
  };

  const block = formatResearchContextBlock(research, "Apex Media");
  assert.ok(block.includes('Researched Opening Line: "99% of creators generate AI video completely backwards."'));
  assert.ok(block.includes("[Beat 1] 99% of creators generate AI video completely backwards."));
  assert.ok(block.includes("[Beat 2] They prompt for a single long video instead of locking character sheets."));
  assert.ok(block.includes("[Scene 1] Creator sits at dark minimalist desk pointing at lens"));
  assert.ok(block.includes("[Scene 2] Camera pans across split-screen"));
  assert.ok(block.includes('Researched CTA Line: "Check the blueprint link below."'));
});

test("compileDeterministicBrief preserves research openingLine, spokenBeats, visualActions, and ctaLine", () => {
  const brand: Brand = {
    id: "brand_1",
    name: "Apex Media",
    tagline: "High Velocity Media",
    niche: "AI Video",
    pillar: "Automation",
    status: "active",
    colors: { primary: "#000", secondary: "#fff", accent: "#f00" },
    socialLinks: {},
    website: "https://apex.ai",
  };

  const research: StructuredResearchContext = {
    sourceName: "Viral AI Case Study",
    platform: "YouTube",
    hookPattern: "Curiosity contrast",
    openingLine: "99% of creators generate AI video completely backwards.",
    spokenBeats: [
      "99% of creators generate AI video completely backwards.",
      "They prompt for a single long video instead of locking character sheets and chaining scenes.",
      "When you frame-lock the environment first, continuity never breaks across cuts.",
      "Check the blueprint link below to steal our multi-panel storyboard system today.",
    ],
    visualActions: [
      "Creator sits at dark minimalist desk pointing directly at macro lens",
      "Camera pans across split-screen showing broken morphing vs locked keyframe",
      "Over-the-shoulder tracking shot of timeline editor chaining panels smoothly",
      "Creator leans back smiling and holds up phone displaying finished render",
    ],
    ctaLine: "Check the blueprint link below to steal our multi-panel storyboard system today.",
  };

  const spark: ViralSpark = {
    id: "spark_1",
    title: "Why Your AI Videos Morph Between Shots",
    hook: "99% of creators generate AI video completely backwards.",
    views: "1.2M",
    velocity: "15k/day",
    platformFit: "YouTube Shorts",
    brandFitScore: 95,
    category: "hot",
    timeWindow: "7d",
    productionTime: "15m",
    whyNow: "Multi-panel consistency is breaking through in 2026",
    angle: "Frame-locking beats one-shot prompting",
    audienceEmotion: "Relief",
    expectedRetention: "88%",
    difficulty: "Low",
    riskLevel: "Low",
    suggestedFormat: "host",
    suggestedProductionMode: "standard",
    researchContext: research,
  };

  const brief = compileDeterministicBrief({
    spark,
    brand,
    productionMode: "standard",
    researchContext: research,
    targetDurationSec: 30,
  });

  // 1. Spoken lines / beats preserved
  assert.equal(brief.beats.length, 4);
  assert.equal(brief.beats[0].spokenLines, "99% of creators generate AI video completely backwards.");
  assert.ok(brief.beats[1].spokenLines.includes("locking character sheets and chaining scenes"));
  assert.ok(brief.beats[2].spokenLines.includes("continuity never breaks across cuts"));
  assert.equal(brief.beats[3].spokenLines, "Check the blueprint link below to steal our multi-panel storyboard system today.");

  // 2. Storyboard visual actions preserved
  assert.equal(brief.storyboard.length, 4);
  assert.equal(brief.storyboard[0].physicalAction, "Creator sits at dark minimalist desk pointing directly at macro lens");
  assert.equal(brief.storyboard[1].physicalAction, "Camera pans across split-screen showing broken morphing vs locked keyframe");
  assert.equal(brief.storyboard[2].physicalAction, "Over-the-shoulder tracking shot of timeline editor chaining panels smoothly");
  assert.equal(brief.storyboard[3].physicalAction, "Creator leans back smiling and holds up phone displaying finished render");

  // 3. Visual description equals physical action (not meta-text)
  assert.equal(brief.storyboard[0].visualDescription, "Creator sits at dark minimalist desk pointing directly at macro lens");
});
