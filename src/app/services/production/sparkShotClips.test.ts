import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectSparkShotClipUrls, isSparkShotClipUrl, sparkShotIndexFromUrl } from "./sparkShotClips";

const shot = (n: number) =>
  `https://xxx.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/shot-${n}.mp4`;

describe("Spark shot clip URLs", () => {
  it("parses shot index and ignores non-shot / non-Spark URLs", () => {
    assert.equal(sparkShotIndexFromUrl(shot(3)), 3);
    assert.equal(isSparkShotClipUrl(shot(1)), true);
    assert.equal(isSparkShotClipUrl("https://vidgen.x.ai/abc.mp4"), false);
    assert.equal(
      isSparkShotClipUrl(
        "https://xxx.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/storyboard/sheet-01.png"
      ),
      false
    );
  });

  it("collects numeric order and skips missing shots", () => {
    const urls = collectSparkShotClipUrls([
      shot(3),
      "https://example.com/other.mp4",
      shot(1),
      undefined,
      shot(1),
      shot(2),
    ]);
    assert.deepEqual(urls, [shot(1), shot(2), shot(3)]);
  });
});
