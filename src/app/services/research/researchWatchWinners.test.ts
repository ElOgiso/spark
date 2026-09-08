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
import { ResearchDepartmentService, computeFingerprint, sparkFingerprintForWatch } from "./researchDepartmentService";
import { ResearchSourceService } from "./researchSourceService";

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

describe("D/E — one ticket per watch, no title templates", () => {
  it("accepted watch writes at most two memories and one spark; second pass updates lastSeenAt", () => {
    const source = { id: "src-1", displayName: "Chan", username: "@c", platform: "youtube", url: "https://youtube.com/@c" } as any;
    const first = ResearchDepartmentService.processVideoResearch("", source, acceptedWatch());
    assert.equal(first.viralSparks.length, 1);
    assert.ok(first.memoryItems.length <= 2);
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
    assert.equal(second.updatedSparks.length, 1);
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

describe("source laws", () => {
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
});
