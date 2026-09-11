import assert from "node:assert/strict";
import test from "node:test";
import { buildProductionProductSheetPrompt } from "./productSheetPrompt";

test("buildProductionProductSheetPrompt creates comprehensive turnaround and detail callouts", () => {
  const prompt = buildProductionProductSheetPrompt({
    productName: "Spark One Phone",
    brandName: "Acme Hardware",
    category: "Mobile Tech",
    description: "Futuristic titanium smartphone with bezel-less glass",
    materials: ["matte brushed titanium", "ceramic back", "sapphire glass"],
    colorPalette: ["Obsidian Black", "Titanium Gray"],
    keyFeatures: ["tactile action button", "flush dual-lens array"],
    dimensionsOrFormFactor: "6.1-inch minimalist slab",
    genre: "Cinematic",
    usageContext: "Handheld in creator studio",
  });

  assert.ok(prompt.includes("Spark One Phone"));
  assert.ok(prompt.includes("Acme Hardware"));
  assert.ok(prompt.includes("Mobile Tech"));
  assert.ok(prompt.includes("FRONT ELEVATION, 3/4 HERO VIEW, SIDE PROFILE, REAR ELEVATION, TOP-DOWN VIEW"));
  assert.ok(prompt.includes("matte brushed titanium"));
  assert.ok(prompt.includes("Zero morphing"));
});
