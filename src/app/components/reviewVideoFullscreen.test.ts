import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  enterReviewVideoFullscreen,
  exitReviewVideoFullscreen,
  isReviewVideoFullscreen,
  reviewVideoObjectFitClass,
  applyReviewFullscreenOrientation,
  unlockReviewFullscreenOrientation,
  type ReviewFsVideo,
  type ReviewFsStage,
} from "./reviewVideoFullscreen";

describe("review video fullscreen", () => {
  it("in-page uses object-cover; fullscreen uses object-contain on black", () => {
    assert.match(reviewVideoObjectFitClass(false), /object-cover/);
    assert.doesNotMatch(reviewVideoObjectFitClass(false), /object-contain/);
    const fs = reviewVideoObjectFitClass(true);
    assert.match(fs, /object-contain/);
    assert.match(fs, /bg-black/);
    assert.doesNotMatch(fs, /object-cover/);
  });

  it("enter tries video.requestFullscreen, then webkitEnterFullscreen, then stage — never the card", async () => {
    const order: string[] = [];
    const video = {
      requestFullscreen: async () => {
        order.push("video.requestFullscreen");
        throw new Error("fail video fs");
      },
      webkitEnterFullscreen: () => {
        order.push("video.webkitEnterFullscreen");
        throw new Error("fail webkit");
      },
    } as unknown as ReviewFsVideo;
    const stage = {
      requestFullscreen: async () => {
        order.push("stage.requestFullscreen");
      },
    } as unknown as ReviewFsStage;
    const card = {
      requestFullscreen: async () => {
        order.push("card.requestFullscreen");
      },
    } as unknown as ReviewFsStage;

    const result = await enterReviewVideoFullscreen({ video, stage });
    assert.equal(result, "stage");
    assert.deepEqual(order, [
      "video.requestFullscreen",
      "video.webkitEnterFullscreen",
      "stage.requestFullscreen",
    ]);
    assert.ok(!order.includes("card.requestFullscreen"));
    void card;
  });

  it("prefers video.requestFullscreen when it succeeds", async () => {
    const video = {
      requestFullscreen: async () => {},
      webkitEnterFullscreen: () => {
        throw new Error("should not run");
      },
    } as unknown as ReviewFsVideo;
    const stage = {
      requestFullscreen: async () => {
        throw new Error("should not run");
      },
    } as unknown as ReviewFsStage;
    assert.equal(await enterReviewVideoFullscreen({ video, stage }), "video");
  });

  it("uses iOS webkitEnterFullscreen when standard FS is missing", async () => {
    let entered = false;
    const video = {
      webkitEnterFullscreen: () => {
        entered = true;
      },
    } as unknown as ReviewFsVideo;
    assert.equal(await enterReviewVideoFullscreen({ video, stage: null }), "webkit");
    assert.equal(entered, true);
  });

  it("isReviewVideoFullscreen is true for video, stage, or webkitDisplayingFullscreen — not the card", () => {
    const video = { webkitDisplayingFullscreen: false } as ReviewFsVideo;
    const stage = {} as ReviewFsStage;
    const card = {} as Element;
    assert.equal(isReviewVideoFullscreen(video, stage, card), false);
    assert.equal(isReviewVideoFullscreen(video, stage, video as unknown as Element), true);
    assert.equal(isReviewVideoFullscreen(video, stage, stage as unknown as Element), true);
    const ios = { webkitDisplayingFullscreen: true } as ReviewFsVideo;
    assert.equal(isReviewVideoFullscreen(ios, stage, null), true);
  });

  it("does not treat webkitRequestFullscreen as the first video fallback", async () => {
    let webkitReq = false;
    const video = {
      webkitRequestFullscreen: async () => {
        webkitReq = true;
      },
      webkitEnterFullscreen: () => {},
    } as unknown as ReviewFsVideo;
    assert.equal(await enterReviewVideoFullscreen({ video, stage: null }), "webkit");
    assert.equal(webkitReq, false);
  });

  it("orientation helpers do not throw when the API is missing", async () => {
    const video = { videoWidth: 1920, videoHeight: 1080 } as ReviewFsVideo;
    await applyReviewFullscreenOrientation(video);
    unlockReviewFullscreenOrientation();
    await exitReviewVideoFullscreen(video);
  });
});
