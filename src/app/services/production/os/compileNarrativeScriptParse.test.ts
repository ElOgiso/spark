import test from "node:test";
import assert from "node:assert/strict";
import {
  extractJsonObject,
  tryLightJsonRepair,
  compileNarrativeScript,
  compileNarrativeScriptPrompt,
  normalizeToNarrativeScript,
  proseFallbackToNarrativeScript,
} from "./compileNarrativeScript";
import { ModelRouter } from "../../runtime/modelRouter";
import type { Brand } from "../../../domain/types";

const mockBrand: Brand = {
  id: "brand-1",
  name: "Apex Engineering",
  niche: "Engineering",
  contentFormat: "host",
  tone: [{ label: "Authoritative", active: true }],
  targetAudience: "Engineers",
  guidelines: [],
  researchSources: [],
  targetDurations: [30],
};

test("SPARK — compileNarrativeScript JSON Extraction & Resilience", async (t) => {
  await t.test("1. extractJsonObject handles markdown fences and conversational wrappers", () => {
    // Markdown fenced JSON
    const fenced = "```json\n{\"title\": \"Test Title\", \"targetDurationSec\": 60}\n```";
    assert.equal(extractJsonObject(fenced), '{"title": "Test Title", "targetDurationSec": 60}');

    // Conversational leading/trailing prose
    const wrapped = "Here is your requested script:\n{\"title\": \"Wrapped Title\", \"val\": 123}\nHope this helps!";
    assert.equal(extractJsonObject(wrapped), '{"title": "Wrapped Title", "val": 123}');

    // Pure JSON
    const pure = '{"a": 1, "b": {"c": 2}}';
    assert.equal(extractJsonObject(pure), pure);

    // Throws on incomplete or missing brackets
    assert.throws(() => extractJsonObject("No JSON here"), /No valid JSON object boundaries found/);
    assert.throws(() => extractJsonObject('{"title": "Cutoff without closing brace'), /No valid JSON object boundaries found/);
    assert.throws(() => extractJsonObject(""), /Cannot extract JSON from empty or non-string input/);
  });

  await t.test("2. tryLightJsonRepair fixes trailing commas", () => {
    const broken = '{"title": "Test", "chapters": [1, 2, ], }';
    const repaired = tryLightJsonRepair(broken);
    assert.equal(repaired, '{"title": "Test", "chapters": [1, 2]}');
    assert.doesNotThrow(() => JSON.parse(repaired));
  });

  await t.test("3. compileNarrativeScriptPrompt includes mandatory complete JSON directive", () => {
    const prompt = compileNarrativeScriptPrompt({
      brand: mockBrand,
      targetDurationSec: 30,
      productionModeLabel: "standard",
    });

    assert.ok(
      prompt.includes("Complete valid JSON is mandatory. Never cut off mid-object."),
      "Must include mandatory complete JSON directive"
    );
    assert.ok(
      prompt.includes("chapters[].spoken is authoritative; fullSpokenScript may be omitted if chapters carry all spoken lines."),
      "Must inform model that chapters[].spoken is authoritative"
    );
  });

  await t.test("4. fullSpokenScript safety: derives fullSpokenScript from chapters[].spoken when omitted", async () => {
    const originalExecute = ModelRouter.executeCategoryRequest;

    const validScriptNoFullSpoken = {
      title: "The Architecture of Megastructures",
      logline: "How engineers design building foundations that survive earthquakes.",
      premise: "Megastructure foundations rely on tuned mass dampers and deep piles.",
      targetDurationSec: 30,
      format: "host",
      hook: {
        spoken: "How do skyscrapers survive massive earthquakes without collapsing into dust?",
        opensOnPayoff: true,
        backstoryDeferred: true,
      },
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "Introduction",
          durationSec: 15,
          job: "hook",
          audio: "talent",
          spoken: "How do skyscrapers survive massive earthquakes without collapsing into dust? The secret lies deep below ground where bedrock anchors every steel beam against catastrophic shear forces.",
          visualIntent: "Slow upward tilt showing a massive skyscraper swaying smoothly.",
        },
        {
          id: "c2",
          order: 2,
          title: "Mechanics",
          durationSec: 15,
          job: "proof",
          audio: "vo",
          spoken: "Tuned mass dampers act like massive pendulums suspended inside the upper towers. When high winds or seismic waves push the structure east, the 600-ton steel sphere swings west to counteract inertia.",
          visualIntent: "Diagram showing tuned mass damper counterbalancing sway.",
        },
      ],
      // fullSpokenScript is intentionally omitted
      openLoops: { plantedAtSec: [0], resolvedAtSec: [25] },
      cta: { spoken: "Follow Apex Engineering for more structural breakdowns.", onScreen: "Subscribe" },
      claims: [{ claim: "Tuned mass dampers absorb up to 40% of lateral kinetic energy.", verified: true, source: "Structural Dynamics Handbook" }],
      contentSource: "ai",
      mustNotCopy: [],
    };

    let passedMaxTokens = 0;
    ModelRouter.executeCategoryRequest = (async (cat: any, opts: any) => {
      passedMaxTokens = opts.maxTokens;
      return JSON.stringify(validScriptNoFullSpoken);
    }) as any;

    try {
      const script = await compileNarrativeScript({
        brand: mockBrand,
        targetDurationSec: 30,
        productionModeLabel: "hybrid",
      });

      assert.equal(passedMaxTokens, 8192, "Must pass maxTokens: 8192 for production script calls");
      assert.ok(script.fullSpokenScript, "fullSpokenScript must be populated");
      assert.ok(
        script.fullSpokenScript.includes("The secret lies deep below ground"),
        "Derived fullSpokenScript must contain chapter 1 spoken lines"
      );
      assert.ok(
        script.fullSpokenScript.includes("Tuned mass dampers act like massive pendulums"),
        "Derived fullSpokenScript must contain chapter 2 spoken lines"
      );
    } finally {
      ModelRouter.executeCategoryRequest = originalExecute;
    }
  });

  await t.test("5. Single call: processes complete valid JSON in one call without retrying", async () => {
    const originalExecute = ModelRouter.executeCategoryRequest;

    let callCount = 0;

    const validCompleteScript = {
      title: "Deep Sea Geothermal Vents",
      logline: "How life thrives around superheated oceanic volcanoes.",
      premise: "Hydrothermal ecosystems thrive without sunlight through chemosynthesis.",
      targetDurationSec: 30,
      format: "faceless",
      hook: {
        spoken: "Two miles beneath the Pacific ocean, water boils at 400 degrees without turning to steam.",
        opensOnPayoff: true,
        backstoryDeferred: true,
      },
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "The Abyss",
          durationSec: 15,
          job: "hook",
          audio: "vo",
          spoken: "Two miles beneath the Pacific ocean, water boils at 400 degrees without turning to steam. Extreme hydrostatic pressure keeps the liquid superheated while black smokers spew mineral rich iron sulfides into total darkness.",
          visualIntent: "Deep-submergence vehicle illuminating a roaring hydrothermal chimney.",
        },
        {
          id: "c2",
          order: 2,
          title: "Chemosynthesis",
          durationSec: 15,
          job: "payoff",
          audio: "vo",
          spoken: "Giant tube worms and blind shrimp thrive here without a single ray of sunlight. Instead of photosynthesis, sulfur-oxidizing bacteria turn poisonous hydrogen sulfide into organic energy, unlocking the origin of Earth's biology.",
          visualIntent: "Macro footage of glowing hydrothermal fauna surrounding vent.",
        },
      ],
      fullSpokenScript:
        "Two miles beneath the Pacific ocean, water boils at 400 degrees without turning to steam. Extreme hydrostatic pressure keeps the liquid superheated while black smokers spew mineral rich iron sulfides into total darkness.\n\nGiant tube worms and blind shrimp thrive here without a single ray of sunlight. Instead of photosynthesis, sulfur-oxidizing bacteria turn poisonous hydrogen sulfide into organic energy, unlocking the origin of Earth's biology.",
      openLoops: { plantedAtSec: [0], resolvedAtSec: [20] },
      cta: { spoken: "Subscribe for deep ocean science.", onScreen: "Subscribe" },
      claims: [{ claim: "Water reaches 400°C at deep sea hydrothermal vents.", verified: true, source: "NOAA Ocean Exploration" }],
      contentSource: "ai",
      mustNotCopy: [],
    };

    ModelRouter.executeCategoryRequest = (async () => {
      callCount++;
      return JSON.stringify(validCompleteScript);
    }) as any;

    try {
      const script = await compileNarrativeScript({
        brand: mockBrand,
        targetDurationSec: 30,
        productionModeLabel: "narrator",
      });

      assert.equal(callCount, 1, "Must make exactly 1 call with no retry");
      assert.equal(script.title, "Deep Sea Geothermal Vents");
    } finally {
      ModelRouter.executeCategoryRequest = originalExecute;
    }
  });

  await t.test("6. Throws descriptive error directly when model output cannot be normalized into a valid script", async () => {
    const originalExecute = ModelRouter.executeCategoryRequest;
    let callCount = 0;

    ModelRouter.executeCategoryRequest = (async () => {
      callCount++;
      return "Broken output without braces";
    }) as any;

    try {
      await assert.rejects(
        async () => {
          await compileNarrativeScript({
            brand: mockBrand,
            targetDurationSec: 30,
            productionModeLabel: "narrator",
          });
        },
        /Validation Failed|fullSpokenScript/
      );
      assert.equal(callCount, 1, "Must fail on single call without retry");
    } finally {
      ModelRouter.executeCategoryRequest = originalExecute;
    }
  });

  await t.test("7. extractJsonObject: truncated chapters JSON with open root and inner } is salvaged via balance repair", () => {
    // Truncated mid-way through chapter 2, inner } of chapter 1 is the last brace
    const truncated = `\`\`\`json
{
  "title": "Ancient Dome Engineering",
  "logline": "How the Roman Pantheon survived 2000 years.",
  "premise": "Volcanic pozzolana concrete creates self-healing crystals.",
  "targetDurationSec": 30,
  "format": "faceless",
  "hook": {
    "spoken": "This 2,000-year-old roof should have collapsed.",
    "opensOnPayoff": true,
    "backstoryDeferred": true
  },
  "chapters": [
    {
      "id": "c1",
      "order": 1,
      "title": "The Impossible Dome",
      "durationSec": 15,
      "job": "hook",
      "audio": "vo",
      "spoken": "This 2,000-year-old roof should have collapsed within a week.",
      "visualIntent": "Low angle shot of the oculus."
    },
    {
      "id": "c2",
      "order": 2,
      "title": "Volcanic Secret",
      "durationSec": 15,
      "job": "proof",
      "audio": "vo",
      "spoken": "The secret lies deep in pozzolana volcanic ash
\`\`\``;

    const extracted = extractJsonObject(truncated);
    assert.ok(extracted.endsWith("}"), "Extracted string must end with closing brace");
    const parsed = JSON.parse(extracted);
    assert.equal(parsed.title, "Ancient Dome Engineering");
    assert.equal(parsed.chapters.length, 1, "Must salvage completed chapter 1 without creating invalid partial chapter 2");
    assert.equal(parsed.chapters[0].id, "c1");
  });

  await t.test("8. extractJsonObject: unsalvageable corrupted syntax throws descriptive error with diagnostic lengths and endsWithBrace", () => {
    const unparseable = '{"title": :::: "broken syntax without valid values"}';
    assert.throws(
      () => extractJsonObject(unparseable),
      (err: any) => {
        const msg = String(err?.message || err);
        return (
          msg.includes("Failed to parse extracted JSON") &&
          msg.includes("rawLength=") &&
          msg.includes("extractedLength=") &&
          msg.includes("endsWithBrace=")
        );
      }
    );
  });

  await t.test("9. compileNarrativeScriptPrompt: fullSpokenScript is NOT in output schema; dialogue quotes and newline rules are present", () => {
    const prompt = compileNarrativeScriptPrompt({
      brand: mockBrand,
      targetDurationSec: 30,
      productionModeLabel: "hybrid",
    });

    // fullSpokenScript must NOT be in the OUTPUT EXACTLY THIS JSON SHAPE block
    const schemaBlock = prompt.split("OUTPUT EXACTLY THIS JSON SHAPE:")[1] || "";
    assert.ok(
      !schemaBlock.includes('"fullSpokenScript"'),
      "fullSpokenScript must not be present in the required output schema"
    );

    // Dialogue quotes and newline escaping rules must be explicitly present
    assert.ok(
      prompt.includes("Inside 'spoken' strings, do NOT use raw unescaped double quotes"),
      "Must instruct model to avoid raw unescaped double quotes"
    );
    assert.ok(
      prompt.includes("Never emit literal unescaped newlines inside strings"),
      "Must instruct model to avoid literal newlines in strings"
    );
  });

  await t.test("10. compileNarrativeScript: makes exactly ONE production call only (no paid retry loop)", async () => {
    const originalExecute = ModelRouter.executeCategoryRequest;
    let callCount = 0;

    ModelRouter.executeCategoryRequest = (async () => {
      callCount++;
      throw new Error(
        "Anthropic Claude output truncated (stop_reason: max_tokens, output_chars: 1574). Model hit token limit."
      );
    }) as any;

    try {
      await assert.rejects(
        async () => {
          await compileNarrativeScript({
            brand: mockBrand,
            targetDurationSec: 30,
            productionModeLabel: "hybrid",
          });
        },
        /Failed to execute narrative script prompt/
      );

      assert.equal(callCount, 1, "Must make exactly ONE call and NOT execute a paid retry loop");
    } finally {
      ModelRouter.executeCategoryRequest = originalExecute;
    }
  });

  await t.test("11. normalizeToNarrativeScript: converts pure prose multi-paragraph writer output into valid NarrativeScript without throwing", () => {
    const proseOutput = `
# The Secret of Roman Concrete

Why are 2,000-year-old Roman harbors still standing while modern concrete crumbles in seawater within decades?

For centuries, civil engineers believed Roman builders just got lucky with their volcanic ash deposits. But modern electron microscopy tells a very different story.

Researchers discovered that millimeter-sized white mineral inclusions, called lime clasts, were not poor mixing as previously assumed. They were quicklime hot-mixed into the concrete.

When seawater cracks the harbor walls, water seeps in and reacts with these lime clasts. The minerals dissolve and recrystallize as calcium carbonate, actively sealing the fractures like scar tissue.

By understanding this ancient self-healing nanotech, coastal cities today can build sea walls that last for centuries instead of decades.

Follow Apex Engineering for more structural breakdowns.
`;

    const script = normalizeToNarrativeScript(proseOutput, {
      brand: mockBrand,
      targetDurationSec: 30,
      productionModeLabel: "hybrid",
    });

    assert.equal(script.title, "The Secret of Roman Concrete");
    assert.ok(script.chapters.length >= 2, "Must extract multiple chapters from paragraphs");
    const totalDuration = script.chapters.reduce((sum, c) => sum + c.durationSec, 0);
    assert.equal(totalDuration, 30, "Chapter durations must sum to exactly targetDurationSec");
    assert.ok(script.fullSpokenScript.includes("Roman harbors still standing"), "fullSpokenScript must contain spoken content");
    assert.ok(script.cta.spoken.includes("Follow Apex Engineering"), "Must extract CTA");
    assert.equal(script.chapters[0].audio, "talent", "Hybrid mode hook chapter must be talent");
    assert.ok((script as any).normalizedFromProse, "Must set normalizedFromProse flag");
  });

  await t.test("12. normalizeToNarrativeScript: converts partial / malformed JSON with spoken lines into valid NarrativeScript", () => {
    const brokenJson = `
{"title": :::: "Deep Sea Geothermal Vents", 
"chapters": [
  {"title": "The Abyss", "spoken": "Two miles beneath the Pacific Ocean, water boils at 400 degrees without turning to steam. Extreme hydrostatic pressure keeps the liquid superheated while black smokers spew mineral rich iron sulfides into total darkness."},
  {"title": "Chemosynthesis", "spoken": "Giant tube worms and blind shrimp thrive here without a single ray of sunlight. Instead of photosynthesis, sulfur-oxidizing bacteria turn poisonous hydrogen sulfide into organic energy."}
`;

    const script = normalizeToNarrativeScript(brokenJson, {
      brand: mockBrand,
      targetDurationSec: 30,
      productionModeLabel: "narrator",
    });

    assert.ok(script.chapters.length >= 2, "Must extract spoken lines from broken JSON");
    const totalDuration = script.chapters.reduce((sum, c) => sum + c.durationSec, 0);
    assert.equal(totalDuration, 30, "Chapter durations must sum to targetDurationSec");
    assert.ok(script.fullSpokenScript.includes("Two miles beneath the Pacific Ocean"), "Must contain chapter 1 spoken lines");
    assert.ok(script.fullSpokenScript.includes("Giant tube worms and blind shrimp"), "Must contain chapter 2 spoken lines");
    assert.equal(script.chapters[0].audio, "vo", "Narrator mode chapters must be vo");
  });

  await t.test("13. normalizeToNarrativeScript: empty or refusal string throws clearly", () => {
    assert.throws(
      () => normalizeToNarrativeScript("", { brand: mockBrand, targetDurationSec: 30, productionModeLabel: "narrator" }),
      /Cannot normalize NarrativeScript from empty/
    );

    assert.throws(
      () => normalizeToNarrativeScript("   \n\t  ", { brand: mockBrand, targetDurationSec: 30, productionModeLabel: "narrator" }),
      /Cannot normalize NarrativeScript from empty/
    );

    assert.throws(
      () => normalizeToNarrativeScript("I cannot fulfill this request due to safety policies.", { brand: mockBrand, targetDurationSec: 30, productionModeLabel: "narrator" }),
      /Model refused request/
    );
  });

  await t.test("14. compileNarrativeScript: Claude returns long non-JSON prose on call 1 -> succeeds immediately without retry", async () => {
    const originalExecute = ModelRouter.executeCategoryRequest;
    let callCount = 0;

    const pureProse = `
# How Supermassive Black Holes Shape Galaxies

At the center of almost every massive galaxy sits a gravitational colossus containing millions or billions of times the mass of our sun.

When gas swirls toward the event horizon, frictional forces heat the accretion disk to trillions of degrees, blasting high-energy quasar jets thousands of light years into intergalactic space.

These cosmic winds blow cold molecular gas out of the host galaxy, starving it of the raw fuel required to ignite new stars. Without this self-regulating feedback loop, galaxies would burn through their fuel too quickly and collapse.

By studying these gravitational engines, astrophysicists can map how the entire cosmic web evolved from the primordial soup.

Follow Apex Engineering for more astrophysics deep dives.
`;

    ModelRouter.executeCategoryRequest = (async () => {
      callCount++;
      return pureProse;
    }) as any;

    try {
      const script = await compileNarrativeScript({
        brand: mockBrand,
        targetDurationSec: 45,
        productionModeLabel: "cinematic",
      });

      assert.equal(callCount, 1, "Must NOT make a second call when Call 1 returns usable prose");
      assert.equal(script.title, "How Supermassive Black Holes Shape Galaxies");
      assert.ok(script.chapters.length >= 3, "Must produce structured chapters");
      const totalDur = script.chapters.reduce((sum, c) => sum + c.durationSec, 0);
      assert.equal(totalDur, 45, "Durations must sum to 45s");
      assert.equal(script.chapters[0].audio, "talent", "Cinematic mode must use talent audio");
      assert.ok(script.fullSpokenScript.includes("At the center of almost every massive galaxy"));
    } finally {
      ModelRouter.executeCategoryRequest = originalExecute;
    }
  });
});

