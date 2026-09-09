import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import {
  proposeContentPillars,
  proposeAudienceProfile,
  shouldProposeBrandBible,
  buildBrandBiblePatch,
  isPlaceholderAudience,
  acceptedWatchesFromResearch,
  compileGenesisDirectorReply,
  parseGenesisAssistantTurn,
  sanitizeGenesisPatch,
  describeGenesisChipPatch,
} from "./proposeBrandBible";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("proposeContentPillars", () => {
  it("returns 3–5 stable multi-word themes from onboard, not marketing buckets", () => {
    const a = proposeContentPillars({
      niche: "Finance & Wealth",
      archetype: "Educator",
      contentFormat: "host",
    });
    const b = proposeContentPillars({
      niche: "Finance & Wealth",
      archetype: "Educator",
      contentFormat: "host",
    });
    assert.deepEqual(a.map((p) => p.label), b.map((p) => p.label));
    assert.ok(a.length >= 3 && a.length <= 5);
    for (const p of a) {
      assert.equal(p.active, true);
      assert.ok(/\s/.test(p.label));
      assert.ok(p.label.length <= 48);
      assert.doesNotMatch(p.label, /^(Educational|Promotional|Behind the Scenes|Motivation|BTS)$/i);
    }
  });

  it("uses agreed watch hook topics when two watches share a token", () => {
    const out = proposeContentPillars({
      niche: "Finance & Wealth",
      archetype: "Educator",
      contentFormat: "host",
      acceptedWatches: [
        { hook_formula: "Name the retention drop then show the save", format: "short 9:16", title: "Retention drop" },
        { hook_formula: "Retention drop then one fix", format: "short 9:16", title: "Fix the drop" },
      ],
    });
    assert.ok(out.some((p) => /retention/i.test(p.label)));
    assert.doesNotMatch(out.map((p) => p.label).join(" | "), /Viral Format/i);
  });

  it("does not emit Educational / Promo / BTS unless those words are in niche or hooks", () => {
    const out = proposeContentPillars({
      niche: "Crypto & Web3",
      archetype: "Operator",
      contentFormat: "faceless",
    });
    const blob = out.map((p) => p.label).join(" ").toLowerCase();
    assert.equal(/educational|promotional|behind the scenes|\bbts\b|motivation/.test(blob), false);
  });
});

describe("proposeAudienceProfile", () => {
  it("is one short who + niche + geo line", () => {
    const line = proposeAudienceProfile({
      niche: "AI & Automation",
      archetype: "Operator",
      country: "Nigeria",
      language: "English (NG)",
    });
    assert.match(line, /operators/i);
    assert.match(line, /automation/i);
    assert.match(line, /Nigeria/);
    assert.ok(line.length <= 140);
    assert.doesNotMatch(line, /high-ticket offers/);
  });
});

describe("when proposer runs", () => {
  it("writes once on empty, skips user-edited, upgrades onboard after new watches", () => {
    const empty = { contentPillars: [], settings: {}, audience: { primary: "", painPoints: [], desires: [] } } as any;
    assert.equal(shouldProposeBrandBible(empty), "onboard");
    assert.equal(
      shouldProposeBrandBible({
        ...empty,
        settings: { pillars_user_edited: true },
      }),
      "skip"
    );
    assert.equal(
      shouldProposeBrandBible(
        { contentPillars: [{ label: "Finance wealth breakdowns for Shorts", active: true }], settings: { bible_proposed_from: "onboard" } } as any,
        { newAcceptedWatchCount: 2 }
      ),
      "watches"
    );
    assert.equal(
      shouldProposeBrandBible(
        { contentPillars: [{ label: "Finance wealth breakdowns for Shorts", active: true }], settings: { bible_proposed_from: "watches" } } as any,
        { newAcceptedWatchCount: 0 }
      ),
      "skip"
    );
  });

  it("seeds placeholder audience and skips when user-edited", () => {
    assert.equal(isPlaceholderAudience("General Audience"), true);
    assert.equal(isPlaceholderAudience("Nigerian operators learning shorts"), false);
    const brand = {
      niche: "Tech & Software",
      archetype: "Builder",
      country: "Kenya",
      language: "English",
      contentPillars: [{ label: "Tech software breakdowns for Shorts", active: true }],
      audience: { primary: "General Audience", painPoints: [], desires: [] },
      settings: { bible_proposed_from: "onboard" },
    } as any;
    const patch = buildBrandBiblePatch(brand, { newAcceptedWatchCount: 0 });
    assert.ok(patch?.audience?.primary);
    assert.doesNotMatch(patch!.audience!.primary, /General Audience/i);
    const locked = buildBrandBiblePatch(
      {
        ...brand,
        tone: [{ label: "Authoritative", active: true }],
        settings: { ...brand.settings, audience_user_edited: true },
      },
      { newAcceptedWatchCount: 0 }
    );
    assert.equal(locked, null);
  });

  it("acceptedWatchesFromResearch drops failed / empty hooks", () => {
    const hints = acceptedWatchesFromResearch([
      { accepted: false, hook_formula: "nope", title: "x", format: "short" } as any,
      { accepted: true, hook_formula: "Curiosity then payoff", title: "Real", format: "short 9:16" } as any,
    ]);
    assert.equal(hints.length, 1);
    assert.equal(hints[0].hook_formula, "Curiosity then payoff");
  });
});

describe("compileGenesisDirectorReply", () => {
  it("maps 15s anime explainers about mobile money in NG", () => {
    const out = compileGenesisDirectorReply("I make 15s anime explainers about mobile money in NG");
    assert.equal(out.niche, "mobile money");
    assert.equal(out.visualGenre, "anime");
    assert.equal(out.targetDurationSec, 15);
    assert.equal(out.country, "Nigeria");
    assert.equal(out.language, "English (NG)");
    assert.equal(out.contentFormat, "anime");
    assert.equal(out.audience, undefined);
  });

  it("does not invent a second niche or a prose genre", () => {
    const out = compileGenesisDirectorReply("just thinking");
    assert.equal(out.niche, undefined);
    assert.equal(out.visualGenre, undefined);
    assert.equal(out.targetDurationSec, undefined);
  });

  it("maps 15 second anime shorts about lagos street food", () => {
    const out = compileGenesisDirectorReply("15 second anime shorts about lagos street food");
    assert.match(out.niche || "", /street food/i);
    assert.equal(out.visualGenre, "anime");
    assert.equal(out.targetDurationSec, 15);
    assert.equal(out.contentFormat, "anime");
    assert.equal(out.country, "Nigeria");
    assert.doesNotMatch(out.niche || "", /Creator Economy/i);
  });
});

describe("parseGenesisAssistantTurn", () => {
  it("reads say + patch and drops slop", () => {
    const turn = parseGenesisAssistantTurn(
      'Lagos street food, anime, 15s.\n{"say":"I set genre to Anime and length to 15s — change any chip.","patch":{"niche":"lagos street food","visualGenre":"anime","targetDurationSec":15,"contentFormat":"anime","audience":"General Audience"}}'
    );
    assert.match(turn.say, /Anime/);
    assert.equal(turn.patch.niche, "lagos street food");
    assert.equal(turn.patch.visualGenre, "anime");
    assert.equal(turn.patch.targetDurationSec, 15);
    assert.equal(turn.patch.audience, undefined);
    assert.equal(sanitizeGenesisPatch({ niche: "Creator Economy", visualGenre: "a moody paragraph" }).niche, undefined);
    assert.match(describeGenesisChipPatch(turn.patch) || "", /Anime/);
  });
});

describe("source laws", () => {
  it("workspace hydrate does not inject template pillars or audience novels", () => {
    const sync = fs.readFileSync(path.join(__dirname, "../../backend/workspaceSync.ts"), "utf8");
    assert.doesNotMatch(sync, /label: "AI & Automation"/);
    assert.doesNotMatch(sync, /Digital creators and forward-thinking professionals/);
    const brief = fs.readFileSync(path.join(__dirname, "../production/productionBriefService.ts"), "utf8");
    assert.match(brief, /active !== false/);
    assert.doesNotMatch(brief, /Strategy, Insights/);
  });

  it("initializeBrandGenesis has no slop fallbacks", () => {
    const ctx = fs.readFileSync(path.join(__dirname, "../../state/SparkContext.tsx"), "utf8");
    const start = ctx.indexOf("const initializeBrandGenesis");
    assert.ok(start >= 0);
    const slice = ctx.slice(start, start + 12000);
    assert.doesNotMatch(slice, /Content Creation/);
    assert.doesNotMatch(slice, /General Audience/);
    assert.doesNotMatch(slice, /Energetic & Relatable/);
    assert.doesNotMatch(slice, /To build a leading media brand/);
    assert.doesNotMatch(slice, /Brand Identity Rule: Focus on/);
  });

  it("genesis look frame imports My Spark catalogs", () => {
    const flow = fs.readFileSync(path.join(__dirname, "../../components/onboarding/BrandGenesisFlow.tsx"), "utf8");
    assert.match(flow, /VISUAL_GENRE_OPTIONS/);
    assert.match(flow, /VIDEO_LENGTH_OPTIONS/);
    assert.match(flow, /PRIMARY_VISUAL_GENRE_IDS/);
    assert.match(flow, /CONTENT_FORMAT_OPTIONS/);
    assert.match(flow, /compileGenesisDirectorReply/);
    assert.match(flow, /section="look"/);
    assert.match(flow, /contentFormat === "faceless"/);
  });

  it("sendChat is live ModelRouter and never recites a reply pool", () => {
    const flow = fs.readFileSync(path.join(__dirname, "../../components/onboarding/BrandGenesisFlow.tsx"), "utf8");
    const start = flow.indexOf("const sendChat");
    assert.ok(start >= 0);
    const slice = flow.slice(start, start + 9000);
    assert.doesNotMatch(slice, /getSparkReply/);
    assert.doesNotMatch(slice, /SPARK_REPLIES/);
    assert.match(slice, /generateOnboardAssistantResponse/);
    assert.match(slice, /ONBOARD_PROVIDER_FAIL/);
    const gem = fs.readFileSync(path.join(__dirname, "../geminiService.ts"), "utf8");
    const onboardStart = gem.indexOf("export async function generateOnboardAssistantResponse");
    const onboard = gem.slice(onboardStart, gem.indexOf("export async function generateSuperSparkVoice"));
    assert.match(onboard, /ModelRouter\.executeCategoryRequest/);
    assert.match(onboard, /"superSpark"/);
    assert.doesNotMatch(onboard, /forcedGemini/);
    assert.doesNotMatch(onboard, /stepFallbacks/);
  });
});
