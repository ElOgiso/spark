import assert from "node:assert/strict";
import test from "node:test";
import {
  assertVideoRequestExecutable,
  looksLikeSheetOrGridUrl,
  looksLikeStoryboardGridUrl,
} from "./capability/assertVideoRequest";
import { requestProductionVideoClip } from "./productionVideoRequest";
import handler from "../../../../api/runtime/video";
import { AIProviderOrchestrator } from "../runtime/AIProviderOrchestrator";

test("Phase 5.1: Fail-Closed Video Submit Path", async (t) => {
  await t.test("1. assertVideoRequestExecutable: Provider & Model Validation", () => {
    // Missing provider
    assert.throws(
      () => assertVideoRequestExecutable({}),
      /Missing required provider/i
    );

    // Unknown provider
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "non_existent_provider",
          firstFrameUrl: "https://example.com/still.png",
        }),
      /is not supported or has no registered capability profile/i
    );

    // Unmapped model for known provider
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
          model: "kling-nonexistent-v99",
          firstFrameUrl: "https://example.com/still.png",
        }),
      /is not supported or has no registered capability profile/i
    );

    // Disabled provider (adapterSupported: false)
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "runway",
          model: "gen3",
          firstFrameUrl: "https://example.com/still.png",
        }),
      /has adapterSupported: false\. Direct execution is disabled/i
    );

    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "luma",
          firstFrameUrl: "https://example.com/still.png",
        }),
      /has adapterSupported: false\. Direct execution is disabled/i
    );

    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
          model: "kling-v3-omni",
          firstFrameUrl: "https://example.com/still.png",
        }),
      /has adapterSupported: false\. Direct execution is disabled/i
    );
  });

  await t.test("2. assertVideoRequestExecutable: I2V First-Frame & Grid Rules", () => {
    // Missing first frame in I2V
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
        }),
      /Still required before motion.*requires a valid firstFrameUrl/i
    );

    // Storyboard grid / contact sheet rejected
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
          firstFrameUrl: "https://storage.spark.io/brands/b1/p1/storyboard-grid.png",
        }),
      /requires this shot's still as firstFrameUrl, not a sheet or storyboard grid/i
    );

    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "grok",
          firstFrameUrl: "https://storage.spark.io/character-sheet.jpg",
        }),
      /requires this shot's still as firstFrameUrl, not a sheet or storyboard grid/i
    );

    // asset:// rejected for Higgsfield
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "higgsfield",
          firstFrameUrl: "asset://local/frame-1.png",
        }),
      /Higgsfield Seedance I2V does not support asset:\/\/ URI scheme/i
    );

    // Grid URL detection functions
    assert.equal(looksLikeSheetOrGridUrl("https://example.com/storyboard_grid.png"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://example.com/character-sheet.jpg"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://example.com/shot-1-still.png"), false);
    assert.equal(looksLikeStoryboardGridUrl("https://example.com/storyboard-grid.png"), true);
    assert.equal(looksLikeStoryboardGridUrl("https://example.com/shot-1-still.png"), false);
  });

  await t.test("3. assertVideoRequestExecutable: R2V Mode Detection & Higgsfield R2V Profile", () => {
    // R2V mode with reference images resolves to seedance-2.5-r2v profile
    const r2vResult = assertVideoRequestExecutable({
      provider: "higgsfield",
      mode: "reference-to-video",
      firstFrameUrl: "https://example.com/shot-1.png",
      referenceImageUrls: ["https://example.com/ref1.png", "https://example.com/ref2.png"],
    });
    assert.equal(r2vResult.ok, true);
    assert.equal(r2vResult.profile?.modelId, "seedance-2.5-r2v");
    assert.equal(r2vResult.profile?.adapterSupported, true);

    // Explicit model seedance-2.0-r2v resolves to R2V profile
    const r2vModelResult = assertVideoRequestExecutable({
      provider: "higgsfield",
      model: "seedance-2.0-r2v",
      firstFrameUrl: "https://example.com/shot-1.png",
      referenceImageUrls: ["https://example.com/ref1.png"],
    });
    assert.equal(r2vModelResult.ok, true);
    assert.equal(r2vModelResult.profile?.modelId, "seedance-2.5-r2v");

    // Standard Higgsfield I2V defaults to seedance-2.5-i2v
    const i2vResult = assertVideoRequestExecutable({
      provider: "higgsfield",
      firstFrameUrl: "https://example.com/shot-1.png",
    });
    assert.equal(i2vResult.ok, true);
    assert.equal(i2vResult.profile?.modelId, "seedance-2.5-i2v");
  });

  await t.test("4. assertVideoRequestExecutable: Valid Executable Requests & Mux Bypass", () => {
    // Valid Kling request
    const klingRes = assertVideoRequestExecutable({
      provider: "kling",
      firstFrameUrl: "https://example.com/shot-1.png",
      durationSec: 5,
      aspectRatio: "9:16",
    });
    assert.equal(klingRes.ok, true);
    assert.equal(klingRes.profile?.providerId, "kling");

    // Valid Grok request
    const grokRes = assertVideoRequestExecutable({
      provider: "grok",
      firstFrameUrl: "https://example.com/shot-1.png",
      durationSec: 6,
    });
    assert.equal(grokRes.ok, true);
    assert.equal(grokRes.profile?.providerId, "grok");

    // Valid Seedance request (via 'ark' alias)
    const arkRes = assertVideoRequestExecutable({
      provider: "ark",
      firstFrameUrl: "https://example.com/shot-1.png",
      durationSec: 5,
    });
    assert.equal(arkRes.ok, true);
    assert.equal(arkRes.profile?.providerId, "seedance");

    // Serverless FFmpeg merge bypass
    const muxRes = assertVideoRequestExecutable({
      provider: "mux",
      action: "mux",
      videoUrls: ["https://storage.spark.io/shot-1.mp4"],
    });
    assert.equal(muxRes.ok, true);
    assert.equal(muxRes.profile, null);
  });

  await t.test("5. requestProductionVideoClip: Fail-Closed Before Fetch", async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ success: true, videoUrl: "https://example.com/v.mp4" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      // 1. Unmapped model fails-closed before fetch
      await assert.rejects(
        () =>
          requestProductionVideoClip({
            provider: "kling",
            model: "unknown-v999",
            prompt: "motion",
            firstFrameUrl: "https://example.com/still.png",
          }),
        /Capability validation failed/i
      );
      assert.equal(fetchCalled, false, "fetch must NEVER be called when model is unknown");

      // 2. Disabled provider (runway) fails-closed before fetch
      await assert.rejects(
        () =>
          requestProductionVideoClip({
            provider: "runway",
            prompt: "motion",
            firstFrameUrl: "https://example.com/still.png",
          }),
        /adapterSupported: false/i
      );
      assert.equal(fetchCalled, false, "fetch must NEVER be called when adapter is disabled");

      // 3. Grid URL rejected before fetch
      await assert.rejects(
        () =>
          requestProductionVideoClip({
            provider: "kling",
            prompt: "motion",
            firstFrameUrl: "https://example.com/storyboard-grid.png",
          }),
        /not a sheet or storyboard grid/i
      );
      assert.equal(fetchCalled, false, "fetch must NEVER be called when first frame is a grid");

      // 4. Valid request proceeds to fetch
      const validRes = await requestProductionVideoClip({
        provider: "kling",
        prompt: "slow pan",
        firstFrameUrl: "https://example.com/shot-1.png",
        durationSec: 5,
      });
      assert.equal(fetchCalled, true, "fetch should be called for valid request");
      assert.equal(validRes.videoUrl, "https://example.com/v.mp4");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("6. API Handler POST /api/runtime/video: Fail-Closed Guard", async () => {
    const createMockReqRes = (body: any) => {
      const req: any = { method: "POST", body };
      let statusCode = 200;
      let jsonBody: any = null;
      const res: any = {
        status(code: number) {
          statusCode = code;
          return res;
        },
        json(data: any) {
          jsonBody = data;
          return res;
        },
      };
      return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
    };

    // 1. Unknown provider rejected with 400
    const mock1 = createMockReqRes({
      provider: "rogue-ai",
      prompt: "test",
      firstFrameUrl: "https://example.com/shot-1.png",
    });
    await handler(mock1.req, mock1.res);
    assert.equal(mock1.getStatus(), 400);
    assert.match(mock1.getJson().error, /is not supported or has no registered capability profile/i);

    // 2. Disabled provider (runway) rejected with 400
    const mock2 = createMockReqRes({
      provider: "runway",
      prompt: "test",
      firstFrameUrl: "https://example.com/shot-1.png",
    });
    await handler(mock2.req, mock2.res);
    assert.equal(mock2.getStatus(), 400);
    assert.match(mock2.getJson().error, /adapterSupported: false/i);

    // 3. Grid start frame rejected with 400
    const mock3 = createMockReqRes({
      provider: "kling",
      prompt: "test",
      firstFrameUrl: "https://example.com/contact-sheet.png",
    });
    await handler(mock3.req, mock3.res);
    assert.equal(mock3.getStatus(), 400);
    assert.match(mock3.getJson().error, /not a sheet or storyboard grid/i);
  });

  await t.test("7. AIProviderOrchestrator: Uses Resolved Provider, Not Hardcoded Grok", async () => {
    let capturedProvider: string | undefined;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: any) => {
      const parsed = JSON.parse(init.body);
      capturedProvider = parsed.provider;
      return new Response(JSON.stringify({ success: true, videoUrl: "https://example.com/clip.mp4" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      // Execute with preferredProvider: "kling"
      const vidUrl = await AIProviderOrchestrator.execute({
        capability: "Video Generation",
        prompt: "cinematic dolly",
        firstFrameUrl: "https://example.com/shot-1.png",
        preferredProvider: "kling",
        durationSec: 5,
        customApiKeys: { KLING_API_KEY: "mock-key" },
      });

      assert.equal(vidUrl, "https://example.com/clip.mp4");
      assert.equal(capturedProvider, "kling", "AIProviderOrchestrator must dispatch using preferredProvider 'kling', not 'grok'");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
