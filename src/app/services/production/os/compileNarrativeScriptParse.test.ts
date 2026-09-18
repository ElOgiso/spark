import test from "node:test";
import assert from "node:assert/strict";
import {
  extractJsonObject,
  tryLightJsonRepair,
  compileNarrativeScript,
  compileNarrativeScriptPrompt,
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

  await t.test("5. Primary recovery: regenerates complete JSON when first attempt is cut off or invalid", async () => {
    const originalExecute = ModelRouter.executeCategoryRequest;

    const callPrompts: string[] = [];
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

    ModelRouter.executeCategoryRequest = (async (cat: any, opts: any) => {
      callCount++;
      callPrompts.push(opts.prompt);

      if (callCount === 1) {
        // Truncated model output (as happened in the confirmed bug)
        return '{"title": "Deep Sea Geothermal Vents", "chapters": [{"id": "c1", "spoken": "Two miles beneath the Pacific';
      }

      // Second call: return valid complete JSON
      return JSON.stringify(validCompleteScript);
    }) as any;

    try {
      const script = await compileNarrativeScript({
        brand: mockBrand,
        targetDurationSec: 30,
        productionModeLabel: "narrator",
      });

      assert.equal(callCount, 2, "Must make second call on parse failure");
      assert.ok(
        callPrompts[1].includes("IMPORTANT RECOVERY INSTRUCTION"),
        "Second call must be a full regenerate with recovery instructions"
      );
      assert.ok(
        !callPrompts[1].includes("FIX THIS JSON"),
        "Must NOT use the broken 'FIX THIS JSON' prompt on truncated output"
      );
      assert.equal(script.title, "Deep Sea Geothermal Vents");
    } finally {
      ModelRouter.executeCategoryRequest = originalExecute;
    }
  });

  await t.test("6. Throws descriptive error with length and tail if retry also fails", async () => {
    const originalExecute = ModelRouter.executeCategoryRequest;

    ModelRouter.executeCategoryRequest = (async () => {
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
        /Failed to parse NarrativeScript JSON after retry/
      );
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

  await t.test("10. compileNarrativeScript: recovers cleanly when first call throws stop_reason: max_tokens truncation", async () => {
    const originalExecute = ModelRouter.executeCategoryRequest;
    const callPrompts: string[] = [];
    let callCount = 0;

    const validScript = {
      title: "Concise Recovered Script",
      logline: "Fast and punchy script delivery.",
      premise: "Short narratives fit within token boundaries.",
      targetDurationSec: 30,
      format: "host",
      hook: {
        spoken: "Here is the concise hook.",
        opensOnPayoff: true,
        backstoryDeferred: true,
      },
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "Main Point",
          durationSec: 30,
          job: "hook",
          audio: "talent",
          spoken: "Here is the concise hook with sufficient words to satisfy the target duration requirements for the thirty-second production format cleanly. We ensure that every structural chapter provides clear value, actionable insights, and verifiable engineering principles so the audience stays engaged from the opening frame all the way to the final call to action.",
          visualIntent: "Host looks directly into lens.",
        },
      ],
      openLoops: { plantedAtSec: [0], resolvedAtSec: [25] },
      cta: { spoken: "Follow for more concise insights.", onScreen: "Follow" },
      claims: [{ claim: "Short scripts have higher completion rates.", verified: true, source: "Media Analytics" }],
      contentSource: "ai",
      mustNotCopy: [],
    };

    ModelRouter.executeCategoryRequest = (async (cat: any, opts: any) => {
      callCount++;
      callPrompts.push(opts.prompt);

      if (callCount === 1) {
        // First call hits Anthropic token limit
        throw new Error(
          "Anthropic Claude output truncated (stop_reason: max_tokens, output_chars: 1574). Model hit token limit."
        );
      }

      // Second call returns complete valid JSON
      return JSON.stringify(validScript);
    }) as any;

    try {
      const script = await compileNarrativeScript({
        brand: mockBrand,
        targetDurationSec: 30,
        productionModeLabel: "hybrid",
      });

      assert.equal(callCount, 2, "Must retry on token limit truncation");
      assert.ok(
        callPrompts[1].includes("CRITICAL RECOVERY INSTRUCTION"),
        "Retry prompt must include CRITICAL RECOVERY INSTRUCTION for token limit"
      );
      assert.ok(
        callPrompts[1].includes("Previous attempt exceeded token limit"),
        "Retry prompt must mention token limit"
      );
      assert.equal(script.title, "Concise Recovered Script");
      assert.ok(script.fullSpokenScript, "Must derive fullSpokenScript automatically");
    } finally {
      ModelRouter.executeCategoryRequest = originalExecute;
    }
  });
});

