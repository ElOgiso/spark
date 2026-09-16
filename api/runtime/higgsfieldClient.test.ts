import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseHiggsfieldKeyString,
  resolveHiggsfieldCredentials,
  resolveHiggsfieldAuth,
  buildHiggsfieldAuthHeader,
  mapHiggsfieldAspectRatio,
  extractImageUrl,
  extractVideoUrl,
  firstImageUrl,
  videoUrl,
  submit,
  pollRequest,
  cancel,
  generateSoulImage,
  generateSeedanceVideo,
} from "./_higgsfieldClient.js";

describe("Phase 0 — Higgsfield Env Aliases & Credentials", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.HIGGSFIELD_API_KEY;
    delete process.env.VITE_HIGGSFIELD_API_KEY;
    delete (process.env as any).Higgsfield_API;
    delete process.env.HIGGSFIELD_API;
    delete process.env.HF_CREDENTIALS;
    delete process.env.HF_KEY;
    delete process.env.HF_API_KEY_ID;
    delete process.env.HF_API_KEY_SECRET;
    delete process.env.HIGGSFIELD_API_KEY_ID;
    delete process.env.HIGGSFIELD_API_KEY_SECRET;
    delete process.env.HIGGSFIELD_KEY_ID;
    delete process.env.HIGGSFIELD_KEY_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("parses colon-separated key into { keyId, keySecret }", () => {
    const creds = parseHiggsfieldKeyString("my_id_1:my_secret_1");
    assert.deepEqual(creds, {
      keyId: "my_id_1",
      keySecret: "my_secret_1",
    });
  });

  test("accepts HIGGSFIELD_API_KEY first", () => {
    process.env.HIGGSFIELD_API_KEY = "key_pri_1:sec_pri_1";
    process.env.VITE_HIGGSFIELD_API_KEY = "key_pri_2:sec_pri_2";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, { keyId: "key_pri_1", keySecret: "sec_pri_1" });
  });

  test("accepts VITE_HIGGSFIELD_API_KEY when HIGGSFIELD_API_KEY missing", () => {
    process.env.VITE_HIGGSFIELD_API_KEY = "key_vite:sec_vite";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, { keyId: "key_vite", keySecret: "sec_vite" });
  });

  test("accepts Higgsfield_API alias", () => {
    (process.env as any).Higgsfield_API = "key_case:sec_case";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, { keyId: "key_case", keySecret: "sec_case" });
  });

  test("accepts HIGGSFIELD_API alias", () => {
    process.env.HIGGSFIELD_API = "key_upper:sec_upper";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, { keyId: "key_upper", keySecret: "sec_upper" });
  });

  test("accepts HF_CREDENTIALS alias", () => {
    process.env.HF_CREDENTIALS = "key_creds:sec_creds";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, { keyId: "key_creds", keySecret: "sec_creds" });
  });

  test("accepts HF_KEY alias", () => {
    process.env.HF_KEY = "key_hf:sec_hf";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, { keyId: "key_hf", keySecret: "sec_hf" });
  });

  test("resolves paired HF_API_KEY_ID + HF_API_KEY_SECRET", () => {
    process.env.HF_API_KEY_ID = "paired_id";
    process.env.HF_API_KEY_SECRET = "paired_secret";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, { keyId: "paired_id", keySecret: "paired_secret" });
  });

  test("customKey parameter takes precedence", () => {
    process.env.HIGGSFIELD_API_KEY = "env_id:env_sec";
    const creds = resolveHiggsfieldCredentials("custom_id:custom_sec");
    assert.deepEqual(creds, { keyId: "custom_id", keySecret: "custom_sec" });
  });

  test("resolveHiggsfieldAuth emits Key {id}:{secret} authorization header", () => {
    process.env.HIGGSFIELD_API_KEY = "auth_id:auth_sec";
    const auth = resolveHiggsfieldAuth();
    assert.deepEqual(auth, { authorization: "Key auth_id:auth_sec" });
  });

  test("returns null when no keys configured", () => {
    assert.equal(resolveHiggsfieldCredentials(), null);
    assert.equal(resolveHiggsfieldAuth(), null);
  });
});

describe("Phase 1 — Higgsfield Client Extractors & Mapping", () => {
  test("maps aspect ratios cleanly", () => {
    assert.equal(mapHiggsfieldAspectRatio("9:16"), "9:16");
    assert.equal(mapHiggsfieldAspectRatio("vertical"), "9:16");
    assert.equal(mapHiggsfieldAspectRatio("portrait"), "9:16");
    assert.equal(mapHiggsfieldAspectRatio("16:9"), "16:9");
    assert.equal(mapHiggsfieldAspectRatio("horizontal"), "16:9");
    assert.equal(mapHiggsfieldAspectRatio("1:1"), "1:1");
    assert.equal(mapHiggsfieldAspectRatio("4:3"), "4:3");
    assert.equal(mapHiggsfieldAspectRatio(""), "9:16");
  });

  test("extractImageUrl extracts images[0].url and aliases", () => {
    assert.equal(extractImageUrl({ images: [{ url: "https://hf.ai/soul.png" }] }), "https://hf.ai/soul.png");
    assert.equal(extractImageUrl({ images: ["https://hf.ai/soul2.png"] }), "https://hf.ai/soul2.png");
    assert.equal(extractImageUrl({ image: { url: "https://hf.ai/soul3.png" } }), "https://hf.ai/soul3.png");
    assert.equal(firstImageUrl({ url: "https://hf.ai/soul4.png" }), "https://hf.ai/soul4.png");
  });

  test("extractVideoUrl extracts video.url and aliases", () => {
    assert.equal(extractVideoUrl({ video: { url: "https://hf.ai/seedance.mp4" } }), "https://hf.ai/seedance.mp4");
    assert.equal(extractVideoUrl({ video: "https://hf.ai/seedance2.mp4" }), "https://hf.ai/seedance2.mp4");
    assert.equal(extractVideoUrl({ videos: [{ url: "https://hf.ai/seedance3.mp4" }] }), "https://hf.ai/seedance3.mp4");
    assert.equal(videoUrl({ output: { video: { url: "https://hf.ai/seedance4.mp4" } } }), "https://hf.ai/seedance4.mp4");
  });
});

describe("Phase 2 & 3 — Soul Stills and Seedance Video (Mocked)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("Soul 2 generates via /higgsfield-ai/soul/v2/standard", async () => {
    let capturedBody: any = null;
    let authHeader = "";

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      if (u.includes("/higgsfield-ai/soul/v2/standard")) {
        capturedBody = JSON.parse(init.body);
        authHeader = init.headers["Authorization"];
        return {
          ok: true,
          json: async () => ({
            request_id: "req_soul_standard",
            status: "queued",
          }),
        } as any;
      }
      if (u.includes("/requests/req_soul_standard/status")) {
        return {
          ok: true,
          json: async () => ({
            status: "completed",
            images: [{ url: "https://hf.ai/soul-standard.png" }],
          }),
        } as any;
      }
      throw new Error("Unexpected fetch: " + u);
    };

    const url = await generateSoulImage(
      {
        prompt: "A heroine character sheet",
        aspectRatio: "9:16",
        resolution: "1080p",
      },
      "hf_id:hf_secret"
    );

    assert.equal(url, "https://hf.ai/soul-standard.png");
    assert.equal(authHeader, "Key hf_id:hf_secret");
    assert.equal(capturedBody.prompt, "A heroine character sheet");
    assert.equal(capturedBody.aspect_ratio, "9:16");
    assert.equal(capturedBody.resolution, "1080p");
    assert.equal(capturedBody.batch_size, 1);
    assert.equal(capturedBody.enhance_prompt, true);
  });

  test("Soul Cinema generates via /higgsfield-ai/soul/cinema", async () => {
    let calledPath = "";

    globalThis.fetch = async (url: any) => {
      calledPath = String(url);
      return {
        ok: true,
        json: async () => ({
          status: "completed",
          images: [{ url: "https://hf.ai/cinema.png" }],
        }),
      } as any;
    };

    const url = await generateSoulImage(
      {
        prompt: "Anamorphic master wide shot",
        model: "soul-cinema",
      },
      "hf_id:hf_secret"
    );

    assert.equal(url, "https://hf.ai/cinema.png");
    assert.ok(calledPath.includes("/higgsfield-ai/soul/cinema"));
  });

  test("Seedance 2.5 I2V generates with public HTTPS still and returns video.url", async () => {
    let calledBody: any = null;

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      if (u.includes("/bytedance/seedance-2.5/image-to-video")) {
        calledBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            request_id: "req_seedance_clip",
            status: "queued",
          }),
        } as any;
      }
      if (u.includes("/requests/req_seedance_clip/status")) {
        return {
          ok: true,
          json: async () => ({
            status: "completed",
            video: { url: "https://hf.ai/seedance-clip.mp4" },
          }),
        } as any;
      }
      throw new Error("Unexpected fetch: " + u);
    };

    const url = await generateSeedanceVideo(
      {
        prompt: "Camera track forward",
        firstFrameUrl: "https://spark.storage.supabase.co/frames/shot-1.png",
        durationSec: 5,
        resolution: "720p",
      },
      "hf_id:hf_secret"
    );

    assert.equal(url, "https://hf.ai/seedance-clip.mp4");
    assert.equal(calledBody.image_url, "https://spark.storage.supabase.co/frames/shot-1.png");
    assert.equal(calledBody.output_format, "mp4");
    assert.equal(calledBody.duration, 5);
  });

  test("Seedance 2.0 I2V omits output_format, respects 720p/480p and clamps duration to 4-15", async () => {
    let calledBody: any = null;
    let calledEndpoint = "";

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      if (u.includes("/bytedance/seedance-2.0/image-to-video")) {
        calledEndpoint = u;
        calledBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            request_id: "req_seedance_20",
            status: "queued",
          }),
        } as any;
      }
      if (u.includes("/requests/req_seedance_20/status")) {
        return {
          ok: true,
          json: async () => ({
            status: "completed",
            video: { url: "https://hf.ai/seedance-20.mp4" },
          }),
        } as any;
      }
      throw new Error("Unexpected fetch: " + u);
    };

    const url = await generateSeedanceVideo(
      {
        prompt: "Slow zoom out",
        firstFrameUrl: "https://spark.storage.supabase.co/frames/shot-2.png",
        model: "seedance-2.0",
        durationSec: 2, // below 4 -> clamped to 4
        resolution: "1080p", // 2.0 doesn't support 1080p -> fallback 720p
      },
      "hf_id:hf_secret"
    );

    assert.equal(url, "https://hf.ai/seedance-20.mp4");
    assert.ok(calledEndpoint.includes("/bytedance/seedance-2.0/image-to-video"));
    assert.equal(calledBody.duration, 4);
    assert.equal(calledBody.resolution, "720p");
    assert.equal(calledBody.output_format, undefined);
  });

  test("Refuses Seedance video without firstFrameUrl", async () => {
    await assert.rejects(
      async () => {
        await generateSeedanceVideo(
          {
            prompt: "No frame provided",
            firstFrameUrl: "",
          },
          "hf_id:hf_secret"
        );
      },
      {
        message: /Higgsfield Seedance I2V requires a valid firstFrameUrl/,
      }
    );
  });

  test("cancel calls /requests/{id}/cancel", async () => {
    let cancelPost = false;

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      if (u.includes("/requests/job_to_abort/cancel") && init.method === "POST") {
        cancelPost = true;
        return { ok: true } as any;
      }
      throw new Error("Unexpected fetch: " + u);
    };

      const res = await cancel("job_to_abort", "hf_id:hf_secret");
      assert.equal(res, true);
      assert.equal(cancelPost, true);
    });
  });

describe("Phase 4 — Production Integration & Upstream Hardening", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  test("looksLikeSheetOrGridUrl detects storyboard grid and sheet artifacts", async () => {
    const { looksLikeSheetOrGridUrl } = await import("./_videoContract.js");
    assert.equal(looksLikeSheetOrGridUrl("https://spark.storage/brands/b1/storyboard-grid.png"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://spark.storage/brands/b1/character-sheet.png"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://spark.storage/brands/b1/prop-sheet-sword.png"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://spark.storage/brands/b1/location-plate.png"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://spark.storage/brands/b1/keyframes/shot-1-still.png"), false);
  });

  test("requestProductionVideoClip rejects storyboard grid as firstFrameUrl for Higgsfield", async () => {
    const { requestProductionVideoClip } = await import("../../src/app/services/production/productionVideoRequest.js");
    await assert.rejects(
      async () => {
        await requestProductionVideoClip({
          provider: "higgsfield",
          prompt: "Dolly in",
          firstFrameUrl: "https://spark.storage/storyboard-grid-9panel.png",
        });
      },
      {
        message: /requires this shot's still as firstFrameUrl, not a sheet or storyboard grid/,
      }
    );
  });

  test("requestProductionVideoClip with valid public HTTPS still succeeds for Higgsfield", async () => {
    let calledBody: any = null;

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      if (u.includes("/api/runtime/video")) {
        calledBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            success: true,
            videoUrl: "https://hf.ai/output.mp4",
            provider: "higgsfield",
          }),
        } as any;
      }
      throw new Error("Unexpected fetch: " + u);
    };

    const { requestProductionVideoClip } = await import("../../src/app/services/production/productionVideoRequest.js");
    const res = await requestProductionVideoClip({
      provider: "higgsfield",
      prompt: "Camera moves forward",
      firstFrameUrl: "https://spark.storage/keyframes/shot-1.png",
      durationSec: 6,
    });

    assert.equal(res.videoUrl, "https://hf.ai/output.mp4");
    assert.equal(calledBody.provider, "higgsfield");
    assert.equal(calledBody.firstFrameUrl, "https://spark.storage/keyframes/shot-1.png");
  });

  test("createHiggsfieldVideoAdapter is registered in execution registry", async () => {
    const { createDefaultAdapterRegistry } = await import("../../src/app/services/production/execution/adapters/registry.js");
    const registry = createDefaultAdapterRegistry();
    assert.ok(registry.has("video:higgsfield"));
    assert.ok(registry.has("higgsfield"));
    const adapter = registry.get("video:higgsfield");
    assert.equal(adapter?.providerId, "higgsfield");
  });

  test("resolveActiveVideoProvider respects preferredVideoProvider = 'higgsfield' even when client key is absent", async () => {
    // Completely clear env keys
    delete process.env.HIGGSFIELD_API_KEY;
    delete process.env.VITE_HIGGSFIELD_API_KEY;
    const { resolveActiveVideoProvider } = await import("../../src/app/services/runtime/providerCapabilities.js");
    const active = resolveActiveVideoProvider({
      preferredVideoProvider: "higgsfield",
    });
    assert.equal(active.providerId, "higgsfield");
    assert.equal(active.maxVideoDurationSec, 15);
    assert.equal(active.supportsNativeAudio, true);
  });

  test("Seedance 2.5 never sends 1080p resolution (clamps to 720p)", async () => {
    let capturedBody: any = null;
    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      if (u.includes("/bytedance/seedance-2.5/image-to-video")) {
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            request_id: "req_res_test",
            status: "queued",
          }),
        } as any;
      }
      if (u.includes("/requests/req_res_test/status")) {
        return {
          ok: true,
          json: async () => ({
            status: "completed",
            video: { url: "https://hf.ai/res-test.mp4" },
          }),
        } as any;
      }
      throw new Error("Unexpected fetch: " + u);
    };

    const url = await generateSeedanceVideo(
      {
        prompt: "Resolution clamp test",
        firstFrameUrl: "https://spark.storage.supabase.co/frames/shot-res.png",
        resolution: "1080p", // 2.5 must clamp to 720p
      },
      "hf_id:hf_secret"
    );

    assert.equal(url, "https://hf.ai/res-test.mp4");
    assert.equal(capturedBody.resolution, "720p");
    assert.notEqual(capturedBody.resolution, "1080p");
  });

  test("GET /api/runtime/execute returns server provider probe without exposing secrets", async () => {
    process.env.HIGGSFIELD_API_KEY = "probe_id:probe_secret";
    const handler = (await import("./execute.js")).default;

    let resStatus = 0;
    let resJson: any = null;
    const mockReq: any = { method: "GET" };
    const mockRes: any = {
      status: (s: number) => {
        resStatus = s;
        return {
          json: (data: any) => {
            resJson = data;
            return data;
          },
        };
      },
    };

    await handler(mockReq, mockRes);
    assert.equal(resStatus, 200);
    assert.equal(resJson?.status, "ok");
    assert.equal(resJson?.providers?.higgsfield, true);
    // Crucial: no secret leaked
    assert.equal(JSON.stringify(resJson).includes("probe_secret"), false);
  });
});
