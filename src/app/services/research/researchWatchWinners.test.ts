/**
 * Research watches winners once → production-shaped Sparks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { VideoUnderstandingProvider } from "./providers/VideoUnderstandingProvider";
import { YouTubeResearchProvider } from "./providers/YouTubeResearchProvider";
import {
  ResearchDepartmentService,
  computeFingerprint,
  sparkFingerprintForWatch,
  formatHookPreferLaw,
  formatCtaPreferLaw,
  SOURCE_TRADEMARK_LAW,
} from "./researchDepartmentService";
import { ResearchSourceService, WATCH_FAIL_DESCRIPTION } from "./researchSourceService";
import { mergeResearchSourceMetadata } from "../../backend/repositories/researchSourceRepository";
import { buildRankedBrandLaws } from "../memory/rankBrandLaws";
import { resolveBriefWhyNow } from "../production/productionBriefService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function read(rel: string) {
  return fs.readFileSync(path.join(__dirname, rel), "utf8");
}

function acceptedWatch(over: Record<string, unknown> = {}) {
  return {
    videoId: "abcdefghijk",
    platform: "youtube",
    title: "How this hook actually works",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    durationSec: 42,
    duration_sec: 42,
    hook_formula: "Curiosity then payoff in one breath",
    opening_line: "Stop scrolling if your retention dies at second three.",
    spoken_beats: ["Name the drop-off", "Show the fix", "Ask for the comment"],
    visual_actions: ["Face close-up", "Cut to timeline", "End card"],
    format: "short 9:16",
    cta_line: "Comment FIX if you want the checklist",
    transcript_ok: true,
    frames_ok: true,
    accepted: true,
    watchStatus: "watched",
    hookAnalysis: "Opens on the drop-off",
    retentionAnalysis: "Cuts before the dip",
    pacingAnalysis: "Tight",
    editingStyle: "Jump cuts",
    storytelling: "Problem then fix",
    visualStyle: "Face + timeline",
    emotionalPattern: "Urgency",
    thumbnailLanguage: "Face + big number",
    CTAAnalysis: "Comment CTA",
    audienceSignals: [],
    viralReasons: [],
    strengths: [],
    weaknesses: [],
    sparkScore: 81,
    confidence: 0.8,
    ...over,
  } as any;
}

describe("A — watch ledger + fingerprint", () => {
  it("builds watchedVideoKey and stable spark fingerprint", () => {
    assert.equal(VideoUnderstandingProvider.watchedVideoKey("YouTube", "abc"), "youtube:abc");
    const a = sparkFingerprintForWatch("youtube", "abc", "hook");
    const b = sparkFingerprintForWatch("youtube", "abc", "hook");
    const c = sparkFingerprintForWatch("youtube", "xyz", "hook");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(computeFingerprint("youtube:abc:hook"), a);
  });

  it("caps register at 5, manual sync at 3, background 0 when ledger already has 5", () => {
    assert.equal(ResearchSourceService.watchCap({ forceManual: true, isRegister: true, successCount: 0 }), 5);
    assert.equal(ResearchSourceService.watchCap({ forceManual: true, isRegister: false, successCount: 5 }), 3);
    assert.equal(ResearchSourceService.watchCap({ forceManual: false, isRegister: false, successCount: 5 }), 0);
    assert.equal(ResearchSourceService.watchCap({ forceManual: false, isRegister: false, successCount: 2 }), 3);
  });
});

describe("B — rank then watch", () => {
  it("ranks by viewCount then likeCount and skips empty ids", () => {
    const ranked = YouTubeResearchProvider.rankWinningVideos(
      [
        { id: "", title: "no id", viewCount: 999 },
        { id: "v2", videoId: "v2", title: "mid", viewCount: 50, likeCount: 9 },
        { id: "v1", videoId: "v1", title: "top", viewCount: 200, likeCount: 1 },
        { id: "v3", videoId: "v3", title: "likes", viewCount: 200, likeCount: 8 },
      ] as any,
      5
    );
    assert.deepEqual(
      ranked.map((v) => v.videoId),
      ["v3", "v1", "v2"]
    );
  });
});

describe("C — fail loud, no canned analysis", () => {
  it("rejects canned / incomplete watches", () => {
    assert.equal(VideoUnderstandingProvider.isAcceptedVideoResearch(acceptedWatch()), true);
    assert.equal(
      VideoUnderstandingProvider.isAcceptedVideoResearch(
        acceptedWatch({ hook_formula: "Presents a high-curiosity opening hook anchored around X" })
      ),
      false
    );
    assert.equal(
      VideoUnderstandingProvider.isAcceptedVideoResearch(acceptedWatch({ spoken_beats: ["only one"] })),
      false
    );
    assert.equal(
      VideoUnderstandingProvider.isAcceptedVideoResearch(acceptedWatch({ transcript_ok: false, frames_ok: false })),
      false
    );
  });

  it("failed watch writes no Memory and no Spark", () => {
    const out = ResearchDepartmentService.processVideoResearch(
      "",
      { id: "src-1", displayName: "Chan", username: "@c", platform: "youtube", url: "https://youtube.com/@c" } as any,
      acceptedWatch({ accepted: false, hook_formula: "" })
    );
    assert.equal(out.viralSparks.length, 0);
    assert.equal(out.memoryItems.length, 0);
  });
});

describe("D/E — one ticket per watch, laws only", () => {
  it("accepted watch writes PREFER/NEVER laws and one spark; second pass updates lastSeenAt", () => {
    const source = { id: "src-1", displayName: "Chan", username: "@c", platform: "youtube", url: "https://youtube.com/@c" } as any;
    const first = ResearchDepartmentService.processVideoResearch("", source, acceptedWatch());
    assert.equal(first.viralSparks.length, 1);
    assert.ok(first.memoryItems.length <= 3);
    assert.ok(first.memoryItems.length >= 1);
    for (const mem of first.memoryItems) {
      assert.match(mem.text, /^\[LAW\] (PREFER|NEVER):/);
      assert.ok(mem.text.length <= 200);
      assert.doesNotMatch(mem.text, /Adaptation:|transcript|view count|Inspiration beats/i);
    }
    const hookLaw = first.memoryItems.find((m) => m.category === "Winning hooks");
    assert.ok(hookLaw);
    assert.equal(
      hookLaw!.text,
      formatHookPreferLaw("Curiosity then payoff in one breath", "short 9:16", "Comment FIX if you want the checklist")
    );
    const ctaLaw = first.memoryItems.find((m) => m.text === formatCtaPreferLaw("Comment FIX if you want the checklist"));
    assert.ok(ctaLaw);
    assert.equal(ctaLaw!.category, "Audience preferences");
    assert.equal(
      first.memoryItems.filter((m) => m.text === SOURCE_TRADEMARK_LAW).length,
      1
    );
    assert.equal(first.viralSparks[0].researchContext?.watchedVideoKey, "youtube:abcdefghijk");
    assert.equal(first.viralSparks[0].hook, "Stop scrolling if your retention dies at second three.");
    const second = ResearchDepartmentService.processVideoResearch(
      "",
      source,
      acceptedWatch(),
      first.memoryItems,
      undefined,
      first.viralSparks
    );
    assert.equal(second.viralSparks.length, 0);
    assert.equal(second.memoryItems.length, 0);
    assert.equal(second.updatedSparks.length, 1);
    const otherVideo = ResearchDepartmentService.processVideoResearch(
      "",
      source,
      acceptedWatch({
        videoId: "otherVideo1",
        url: "https://www.youtube.com/watch?v=otherVideo1",
        hook_formula: "Name the loss then show the save",
        opening_line: "Your last ten videos died at the same second.",
      }),
      first.memoryItems,
      undefined,
      first.viralSparks
    );
    assert.equal(otherVideo.memoryItems.filter((m) => m.text === SOURCE_TRADEMARK_LAW).length, 0);
  });

  it("processPatterns does not mint Viral Format title sparks", () => {
    const out = ResearchDepartmentService.processPatterns(
      "",
      { id: "src", displayName: "Chan", platform: "youtube", recentVideos: [{ title: "Wow", viewCount: 9 }] } as any,
      [
        {
          id: "p1",
          sourceId: "src",
          patternType: "Hook",
          title: "Viral Format: Wow...",
          description: "template",
          evidence: "views",
          confidence: 0.9,
          originWeight: 0.9,
          createdAt: new Date().toISOString(),
        },
      ]
    );
    assert.equal(out.viralSparks.length, 0);
    assert.equal(out.memoryItems.length, 0);
  });
});

describe("source laws + memory feed", () => {
  it("removes canned persist paths and Viral Format pattern persist", () => {
    const dept = read("researchDepartmentService.ts");
    const yt = read("providers/YouTubeResearchProvider.ts");
    const vu = read("providers/VideoUnderstandingProvider.ts");
    const src = read("researchSourceService.ts");
    assert.doesNotMatch(dept, /Organic value bridge/);
    assert.doesNotMatch(dept, /curiosity-first frame/);
    assert.doesNotMatch(dept, /Viral Format:/);
    assert.doesNotMatch(yt, /Viral Format:/);
    assert.doesNotMatch(vu, /hookAnalysis:\s*aiResult\?\.hookAnalysis\s*\|\|/);
    assert.doesNotMatch(vu, /pacingAnalysis:\s*`Fast-paced/);
    assert.doesNotMatch(src, /persistResearchPatternCreate/);
    assert.match(src, /watchLedger/);
    assert.match(vu, /hook_formula/);
  });

  it("empty Memory does not invent executive-authority filler", () => {
    const empty = buildRankedBrandLaws([]);
    assert.equal(empty.lawsBlock, "");
    assert.deepEqual(empty.hardLaws, []);
    const brief = read("../production/productionBriefService.ts");
    const ranker = read("../memory/rankBrandLaws.ts");
    assert.doesNotMatch(brief, /sharp executive authority/);
    assert.doesNotMatch(brief, /executive authority/);
    assert.doesNotMatch(ranker, /sharp executive authority/);
    assert.doesNotMatch(brief, /zero filler words/);
    assert.doesNotMatch(ranker, /zero filler words/);
  });

  it("persist + hydrate map watchLedger both directions on research_sources.metadata", () => {
    const repo = fs.readFileSync(path.join(__dirname, "../../backend/repositories/researchSourceRepository.ts"), "utf8");
    const sync = fs.readFileSync(path.join(__dirname, "../../backend/workspaceSync.ts"), "utf8");
    assert.match(repo, /watchLedger:\s*Array\.isArray\(meta\.watchLedger\)\s*\?\s*meta\.watchLedger/);
    assert.match(repo, /watchLedger:\s*\(values as any\)\.watchLedger/);
    assert.match(repo, /mergeResearchSourceMetadata/);
    assert.match(repo, /metadataPatch\.watchLedger/);
    assert.match(repo, /metadataPatch\.learnings/);
    assert.match(repo, /metadataPatch\.sourceType/);
    assert.match(repo, /metadataPatch\.videoResearch/);
    assert.match(sync, /persistResearchSourceCreate/);
    assert.match(sync, /persistResearchSourceUpdate/);
    assert.match(sync, /listResearchSources/);
  });

  it("update metadata merge keeps watchLedger when only lastSyncedAt is patched", () => {
    const merged = mergeResearchSourceMetadata(
      {
        watchLedger: [{ watchedVideoKey: "youtube:abc", status: "watched" }],
        learnings: ["Curiosity then payoff"],
        sourceType: "channel",
        videoResearch: { videoId: "abc" },
        avatar: "https://img",
      },
      { lastSyncedAt: "2026-09-08T00:00:00.000Z" }
    );
    assert.deepEqual(merged.watchLedger, [{ watchedVideoKey: "youtube:abc", status: "watched" }]);
    assert.deepEqual(merged.learnings, ["Curiosity then payoff"]);
    assert.equal(merged.sourceType, "channel");
    assert.equal((merged.videoResearch as any).videoId, "abc");
    assert.equal(merged.lastSyncedAt, "2026-09-08T00:00:00.000Z");
    assert.equal(merged.avatar, "https://img");
  });

  it("youtube channel with 0 accepted is needs_attention; accepted clears it", () => {
    const fail = ResearchSourceService.applyWatchOutcomeStatus({
      source: {
        platform: "youtube",
        sourceType: "channel",
        description: "Channel about ops",
        status: "active",
      } as any,
      accepted: [],
    });
    assert.equal(fail.status, "needs_attention");
    assert.equal(fail.description, WATCH_FAIL_DESCRIPTION);
    const tickets = ResearchSourceService.applyWatchTickets({
      source: { id: "src", platform: "youtube", displayName: "Chan", username: "@c", url: "https://youtube.com/@c" } as any,
      watches: [],
    });
    assert.equal(tickets.videoSparks.length, 0);
    assert.equal(tickets.videoMemories.length, 0);
    const ok = ResearchSourceService.applyWatchOutcomeStatus({
      source: {
        platform: "youtube",
        sourceType: "channel",
        description: WATCH_FAIL_DESCRIPTION,
        status: "needs_attention",
      } as any,
      accepted: [acceptedWatch()],
    });
    assert.equal(ok.status, "active");
    assert.equal(ok.description, "");
  });

  it("second sync does not analyzeVideo for watched ledger keys", async () => {
    let calls = 0;
    const orig = VideoUnderstandingProvider.analyzeVideo;
    VideoUnderstandingProvider.analyzeVideo = async () => {
      calls += 1;
      return acceptedWatch();
    };
    try {
      const source = {
        id: "src",
        platform: "youtube",
        sourceType: "channel",
        url: "https://youtube.com/@c",
        username: "@c",
        displayName: "Chan",
        watchLedger: [{ watchedVideoKey: "youtube:v1", status: "watched", watchedAt: "2026-01-01T00:00:00.000Z" }],
        learnings: ["fp"],
      } as any;
      const out = await ResearchSourceService.watchRankedWinners({
        source,
        videos: [{ id: "v1", videoId: "v1", title: "watched already", viewCount: 99 }] as any,
        forceManual: true,
        isRegister: false,
      });
      assert.equal(calls, 0);
      assert.equal(out.accepted.length, 0);
      assert.equal(out.ledger.filter((e) => e.watchedVideoKey === "youtube:v1").length, 1);
    } finally {
      VideoUnderstandingProvider.analyzeVideo = orig;
    }
  });

  it("whyNow brief fallback is hook then niche then empty — no invented flavor", () => {
    assert.equal(resolveBriefWhyNow({ whyNow: "Margins compress", hook: "Ignore me" } as any, { niche: "AI ops" }), "Margins compress");
    assert.equal(resolveBriefWhyNow({ whyNow: "", hook: "Stop scrolling at second three." } as any, { niche: "AI ops" }), "Stop scrolling at second three.");
    assert.equal(resolveBriefWhyNow({ whyNow: "", hook: "", hook_formula: "Name the loss" } as any, { niche: "AI ops" }), "Name the loss");
    assert.equal(resolveBriefWhyNow({ whyNow: "", hook: "" } as any, { niche: "AI ops" }), "AI ops");
    assert.equal(resolveBriefWhyNow({ whyNow: "", hook: "" } as any, { niche: "" }), "");
    const brief = read("../production/productionBriefService.ts");
    assert.doesNotMatch(brief, /High curiosity gap paired with/);
    assert.doesNotMatch(brief, /executive authority/);
    const drawer = fs.readFileSync(path.join(__dirname, "../../components/MySpark.tsx"), "utf8");
    assert.doesNotMatch(drawer, /observationsCategorized/);
    assert.doesNotMatch(drawer, /SPARK Analysis Observations/);
  });

  it("origin caption proxy lives on existing /api/runtime/video and Hobby functions stay at 12", () => {
    const videoSrc = fs.readFileSync(path.join(__dirname, "../../../../api/runtime/video.ts"), "utf8");
    assert.match(videoSrc, /isYoutubeCaptionsRequest/);
    assert.match(videoSrc, /fetchYoutubeTimedTextPlain/);
    assert.match(videoSrc, /en-US/);
    assert.match(videoSrc, /a\.en/);
    const vu = read("providers/VideoUnderstandingProvider.ts");
    assert.match(vu, /\/api\/runtime\/video\?action=captions/);
    assert.match(vu, /res\.status === 404/);
    const xml = `<transcript><text start="0">Hello &amp; welcome</text><text>to the show&#39;s open</text></transcript>`;
    assert.equal(VideoUnderstandingProvider.decodeTimedTextXml(xml), "Hello & welcome to the show's open");
    const apiRoot = path.join(__dirname, "../../../../api");
    const lambdas: string[] = [];
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (
          ent.isFile() &&
          ent.name.endsWith(".ts") &&
          !ent.name.endsWith(".test.ts") &&
          !ent.name.startsWith("_")
        ) {
          lambdas.push(p);
        }
      }
    };
    walk(apiRoot);
    assert.ok(lambdas.length <= 12, `Hobby functions ${lambdas.length} > 12: ${lambdas.join(", ")}`);
    assert.ok(lambdas.some((p) => p.endsWith(`${path.sep}video.ts`)));
  });

  it("ranker puts pinned and hook laws first and caps at 10", () => {
    const items = [
      { id: "a", type: "learned" as const, text: "Audience likes longer outros", dateAdded: "2026-01-01", category: "Audience preferences" as const },
      { id: "h", type: "learned" as const, text: "[LAW] PREFER: name the drop in short 9:16.", dateAdded: "2026-01-02", category: "Winning hooks" as const },
      { id: "p", type: "rule" as const, text: "[LAW] NEVER: promise fake view counts.", dateAdded: "2026-01-03", category: "Brand" as const, pinned: true },
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `x${i}`,
        type: "learned" as const,
        text: `[LAW] PREFER: filler law ${i}.`,
        dateAdded: "2026-01-04",
        category: "Audience preferences" as const,
      })),
    ];
    const ranked = buildRankedBrandLaws(items, 10);
    assert.equal(ranked.used.length, 10);
    assert.match(ranked.lawsBlock.split("\n")[0], /NEVER: promise fake view counts/);
    assert.match(ranked.lawsBlock.split("\n")[1], /PREFER: name the drop/);
    assert.doesNotMatch(ranked.lawsBlock, /sharp executive authority/);
  });

  it("Video / Image / TTS execute options do not take memoryItems", () => {
    const pas = fs.readFileSync(path.join(__dirname, "../production/productionAssetService.ts"), "utf8");
    const orch = fs.readFileSync(path.join(__dirname, "../runtime/AIProviderOrchestrator.ts"), "utf8");
    const router = fs.readFileSync(path.join(__dirname, "../runtime/modelRouter.ts"), "utf8");
    const videoBlocks = pas.match(/executeCategoryRequest\(\s*"videoGeneration"[\s\S]*?\}\)/g) || [];
    assert.ok(videoBlocks.length >= 1);
    for (const block of videoBlocks) {
      assert.doesNotMatch(block, /memoryItems/);
    }
    const imageBlocks = pas.match(/executeCategoryRequest\(\s*"storyboardImages"[\s\S]*?\}\)/g) || [];
    for (const block of imageBlocks) {
      assert.doesNotMatch(block, /memoryItems/);
    }
    assert.match(orch, /export interface AIExecutionOptions/);
    assert.doesNotMatch(orch.slice(orch.indexOf("export interface AIExecutionOptions"), orch.indexOf("export interface AIProviderPlugin")), /memoryItems/);
    assert.match(router, /memoryItems: _omitMemoryItems/);
  });
});
