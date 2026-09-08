import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseProductionIdFromPage,
  readSparkReviewFocusId,
  openProductionReviewDetail,
  resolveCardPlayableVideoUrl,
  SPARK_REVIEW_FOCUS_KEY,
} from "./homeReviewCardMedia";

const SPARK_VIDEO =
  "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/master.mp4";
const STILL = "https://example.com/scene-1.png";

describe("homeReviewCardMedia", () => {
  it("parses productionId from SPA currentPage query", () => {
    assert.equal(parseProductionIdFromPage("/review/creative?productionId=prod-9"), "prod-9");
    assert.equal(parseProductionIdFromPage("/review"), null);
  });

  it("prefers sessionStorage then currentPage for focusId", () => {
    const store: Record<string, string> = {};
    const fake = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };
    (globalThis as any).sessionStorage = fake;
    fake.setItem(SPARK_REVIEW_FOCUS_KEY, "from-storage");
    assert.equal(readSparkReviewFocusId("/review/creative?productionId=from-query"), "from-storage");
    assert.equal(store[SPARK_REVIEW_FOCUS_KEY], undefined);
    assert.equal(readSparkReviewFocusId("/review/creative?productionId=from-query"), "from-query");
  });

  it("openProductionReviewDetail writes focus id and navigates to CreativeReview", () => {
    const store: Record<string, string> = {};
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };
    let path = "";
    openProductionReviewDetail((p) => {
      path = p;
    }, "abc-123");
    assert.equal(store[SPARK_REVIEW_FOCUS_KEY], "abc-123");
    assert.equal(path, "/review/creative?productionId=abc-123");
  });

  it("card video prefers production.videoUrl over stills and generatedVideos", () => {
    const url = resolveCardPlayableVideoUrl({
      videoUrl: SPARK_VIDEO,
      scenes: [{ image: STILL }],
      brief: {
        videoUrl: "https://example.com/brief.mp4",
        generatedAssets: { generatedVideos: ["https://example.com/gen.mp4"], generatedFrames: [STILL] },
      },
    });
    assert.equal(url, SPARK_VIDEO);
  });

  it("falls through to generatedVideos then canonical when production.videoUrl is missing", () => {
    const url = resolveCardPlayableVideoUrl({
      scenes: [{ image: STILL }],
      brief: {
        generatedAssets: { generatedVideos: [SPARK_VIDEO], generatedFrames: [STILL] },
      },
    });
    assert.equal(url, SPARK_VIDEO);
  });

  it("returns undefined when only a still exists", () => {
    assert.equal(
      resolveCardPlayableVideoUrl({
        scenes: [{ image: STILL }],
        brief: { generatedAssets: { generatedFrames: [STILL] } },
      }),
      undefined
    );
  });
});
