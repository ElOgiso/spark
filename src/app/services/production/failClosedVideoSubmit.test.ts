import assert from "node:assert/strict";
import test from "node:test";
import {
  assertVideoRequestExecutable,
  looksLikeSheetOrGridUrl,
  looksLikeStoryboardGridUrl,
  normalizeProviderIdentifier,
  resolveLegacyCompatibilityModel,
  PROVIDER_IDENTIFIER_ALIASES,
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

  await t.test("6. API Handler POST /api/runtime/video: Fail-Closed Guard", async (t) => {
    const oldUrl = process.env.SUPABASE_URL;
    const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_URL = "https://auth.spark.invalid";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable";
    t.after(() => {
      if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
      if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
    });
    t.mock.method(globalThis, "fetch", async (url: any) => {
      const u = String(url);
      if (u.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "test-user" }));
      if (u.includes("/rest/v1/profiles")) return new Response(JSON.stringify({ access_status: "active" }));
      throw new Error("Unexpected provider call: " + u);
    });
    const createMockReqRes = (body: any) => {
      const req: any = { method: "POST", headers: { authorization: "Bearer test-session" }, body };
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

test("Phase 5.2: Capability Boundary Hardening (Tests A-L)", async (t) => {
  await t.test("Test A: Explicit providerId + modelId validated without substitution", () => {
    // Exact model validated directly
    const klingRes = assertVideoRequestExecutable({
      provider: "kling",
      model: "kling-v2-6",
      firstFrameUrl: "https://example.com/shot-1.png",
      durationSec: 5,
    });
    assert.equal(klingRes.ok, true);
    assert.equal(klingRes.profile?.providerId, "kling");
    assert.equal(klingRes.profile?.modelId, "kling-v2-6");

    const hfRes = assertVideoRequestExecutable({
      provider: "higgsfield",
      model: "seedance-2.5-i2v",
      firstFrameUrl: "https://example.com/shot-1.png",
      durationSec: 5,
    });
    assert.equal(hfRes.ok, true);
    assert.equal(hfRes.profile?.providerId, "higgsfield");
    assert.equal(hfRes.profile?.modelId, "seedance-2.5-i2v");

    // No silent substitution: passing I2V model with R2V mode must reject, NOT silently swap to seedance-2.5-r2v
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "higgsfield",
          model: "seedance-2.5-i2v",
          mode: "reference-to-video",
          firstFrameUrl: "https://example.com/shot-1.png",
          referenceImageUrls: ["https://example.com/ref.png"],
        }),
      /does not support reference-to-video \(R2V\) mode/i
    );
  });

  await t.test("Test B: Known provider + unknown model rejects (fail-closed)", () => {
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
          model: "kling-v999-invalid",
          firstFrameUrl: "https://example.com/shot-1.png",
        }),
      /is not supported or has no registered capability profile/i
    );

    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "higgsfield",
          model: "unknown-seedance-xyz",
          firstFrameUrl: "https://example.com/shot-1.png",
        }),
      /is not supported or has no registered capability profile/i
    );
  });

  await t.test("Test C: Disabled model (adapterSupported: false) rejects", () => {
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "runway",
          model: "gen3",
          firstFrameUrl: "https://example.com/shot-1.png",
        }),
      /has adapterSupported: false\. Direct execution is disabled/i
    );

    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
          model: "kling-v3-omni",
          firstFrameUrl: "https://example.com/shot-1.png",
        }),
      /has adapterSupported: false\. Direct execution is disabled/i
    );
  });

  await t.test("Test D: Explicit I2V passes when model supports it", () => {
    const res = assertVideoRequestExecutable({
      provider: "kling",
      model: "kling-v2-6",
      mode: "image_to_video",
      firstFrameUrl: "https://example.com/shot-1.png",
      durationSec: 5,
    });
    assert.equal(res.ok, true);
    assert.equal(res.profile?.modelId, "kling-v2-6");
  });

  await t.test("Test E: Explicit R2V passes when model supports it", () => {
    const res = assertVideoRequestExecutable({
      provider: "higgsfield",
      model: "seedance-2.5-r2v",
      mode: "reference-to-video",
      firstFrameUrl: "https://example.com/shot-1.png",
      referenceImageUrls: ["https://example.com/ref1.png"],
      durationSec: 5,
    });
    assert.equal(res.ok, true);
    assert.equal(res.profile?.modelId, "seedance-2.5-r2v");
  });

  await t.test("Test F: References + identityCritical do NOT imply R2V; stays I2V", () => {
    // 1. Without firstFrameUrl, must reject because I2V requires first frame (does not infer R2V)
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "higgsfield",
          referenceImageUrls: ["https://example.com/ref1.png"],
          identityCritical: true,
        }),
      /Still required before motion.*requires a valid firstFrameUrl/i
    );

    // 2. With firstFrameUrl, resolves to I2V model (seedance-2.5-i2v), NOT R2V
    const res = assertVideoRequestExecutable({
      provider: "higgsfield",
      firstFrameUrl: "https://example.com/shot-1.png",
      referenceImageUrls: ["https://example.com/ref1.png"],
      identityCritical: true,
    });
    assert.equal(res.ok, true);
    assert.equal(res.profile?.modelId, "seedance-2.5-i2v");
  });

  await t.test("Test G: Missing first frame fails on I2V", () => {
    for (const provider of ["kling", "seedance", "grok", "higgsfield"]) {
      assert.throws(
        () =>
          assertVideoRequestExecutable({
            provider,
          }),
        /Still required before motion.*requires a valid firstFrameUrl/i
      );
    }
  });

  await t.test("Test H: Storyboard / contact sheet fails on I2V first frame", () => {
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "seedance",
          firstFrameUrl: "https://storage.spark.io/storyboard-grid.png",
        }),
      /requires this shot's still as firstFrameUrl, not a sheet or storyboard grid/i
    );

    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
          firstFrameUrl: "https://storage.spark.io/character-sheet.jpg",
        }),
      /requires this shot's still as firstFrameUrl, not a sheet or storyboard grid/i
    );
  });

  await t.test("Test I: Unsupported output constraints fail", () => {
    // Kling only supports 5s or 10s duration
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
          firstFrameUrl: "https://example.com/shot-1.png",
          durationSec: 99,
        }),
      /REJECTED_UNSUPPORTED_DURATION/i
    );

    // Kling only supports 16:9, 9:16, 1:1
    assert.throws(
      () =>
        assertVideoRequestExecutable({
          provider: "kling",
          firstFrameUrl: "https://example.com/shot-1.png",
          aspectRatio: "3:1",
        }),
      /REJECTED_UNSUPPORTED_ASPECT_RATIO/i
    );
  });

  await t.test("Test J: Non-generative mux/merge bypass remains functional", () => {
    const muxRes = assertVideoRequestExecutable({
      provider: "mux",
      action: "mux",
      videoUrls: ["https://storage.spark.io/shot-1.mp4", "https://storage.spark.io/shot-2.mp4"],
    });
    assert.equal(muxRes.ok, true);
    assert.equal(muxRes.profile, null);

    const mergeRes = assertVideoRequestExecutable({
      action: "merge",
      videoUrls: ["https://storage.spark.io/shot-1.mp4"],
    });
    assert.equal(mergeRes.ok, true);
    assert.equal(mergeRes.profile, null);
  });

  await t.test("Test K: Direct generative video path bypass check", async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ success: true, videoUrl: "https://example.com/clip.mp4" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      // Must reject before fetch if unknown model
      await assert.rejects(
        () =>
          requestProductionVideoClip({
            provider: "kling",
            model: "nonexistent-model",
            prompt: "test",
            firstFrameUrl: "https://example.com/shot-1.png",
          }),
        /Capability validation failed/i
      );
      assert.equal(fetchCalled, false, "fetch must not be called when capability validation fails");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("Test L: Provider lexical aliases normalize correctly", () => {
    assert.equal(normalizeProviderIdentifier("ark"), "seedance");
    assert.equal(normalizeProviderIdentifier("xai"), "grok");
    assert.equal(normalizeProviderIdentifier("higgsfield-seedance"), "higgsfield");
    assert.equal(normalizeProviderIdentifier("google"), "gemini");

    // Validates properly through assertVideoRequestExecutable
    const arkRes = assertVideoRequestExecutable({
      provider: "ark",
      firstFrameUrl: "https://example.com/shot-1.png",
      durationSec: 5,
    });
    assert.equal(arkRes.ok, true);
    assert.equal(arkRes.profile?.providerId, "seedance");

    const xaiRes = assertVideoRequestExecutable({
      provider: "xai",
      firstFrameUrl: "https://example.com/shot-1.png",
      durationSec: 6,
    });
    assert.equal(xaiRes.ok, true);
    assert.equal(xaiRes.profile?.providerId, "grok");
  });
});
