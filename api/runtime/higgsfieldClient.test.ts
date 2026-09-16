import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseHiggsfieldKeyString,
  resolveHiggsfieldCredentials,
  buildHiggsfieldAuthHeader,
  mapHiggsfieldAspectRatio,
  firstImageUrl,
  videoUrl,
  generateSoulImage,
  generateSeedanceVideo,
  cancelHiggsfieldRequest,
} from "./_higgsfieldClient.js";

describe("Higgsfield Client - Credentials & Auth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.HIGGSFIELD_API_KEY;
    delete process.env.HF_CREDENTIALS;
    delete process.env.HF_KEY;
    delete process.env.VITE_HIGGSFIELD_API_KEY;
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

  test("parseHiggsfieldKeyString parses colon-separated key", () => {
    const creds = parseHiggsfieldKeyString("my_key_id:my_secret_token_123");
    assert.deepEqual(creds, {
      keyId: "my_key_id",
      keySecret: "my_secret_token_123",
    });
  });

  test("parseHiggsfieldKeyString parses pipe-separated key and trims whitespace", () => {
    const creds = parseHiggsfieldKeyString("  hf_id_abc | hf_sec_xyz  ");
    assert.deepEqual(creds, {
      keyId: "hf_id_abc",
      keySecret: "hf_sec_xyz",
    });
  });

  test("parseHiggsfieldKeyString returns null on invalid or missing input", () => {
    assert.equal(parseHiggsfieldKeyString(""), null);
    assert.equal(parseHiggsfieldKeyString(undefined), null);
    assert.equal(parseHiggsfieldKeyString("no_separator_here"), null);
    assert.equal(parseHiggsfieldKeyString(":secret_only"), null);
    assert.equal(parseHiggsfieldKeyString("id_only:"), null);
  });

  test("resolveHiggsfieldCredentials resolves from HIGGSFIELD_API_KEY", () => {
    process.env.HIGGSFIELD_API_KEY = "env_id_1:env_secret_1";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, {
      keyId: "env_id_1",
      keySecret: "env_secret_1",
    });
  });

  test("resolveHiggsfieldCredentials resolves from HF_CREDENTIALS", () => {
    process.env.HF_CREDENTIALS = "env_id_2:env_secret_2";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, {
      keyId: "env_id_2",
      keySecret: "env_secret_2",
    });
  });

  test("resolveHiggsfieldCredentials resolves from HF_KEY", () => {
    process.env.HF_KEY = "env_id_3:env_secret_3";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, {
      keyId: "env_id_3",
      keySecret: "env_secret_3",
    });
  });

  test("resolveHiggsfieldCredentials resolves from separated HF_API_KEY_ID and HF_API_KEY_SECRET", () => {
    process.env.HF_API_KEY_ID = "hf_separate_id";
    process.env.HF_API_KEY_SECRET = "hf_separate_secret";
    const creds = resolveHiggsfieldCredentials();
    assert.deepEqual(creds, {
      keyId: "hf_separate_id",
      keySecret: "hf_separate_secret",
    });
  });

  test("resolveHiggsfieldCredentials gives priority to customKey argument", () => {
    process.env.HIGGSFIELD_API_KEY = "env_id:env_secret";
    const creds = resolveHiggsfieldCredentials("override_id:override_secret");
    assert.deepEqual(creds, {
      keyId: "override_id",
      keySecret: "override_secret",
    });
  });

  test("resolveHiggsfieldCredentials returns null when no credentials configured", () => {
    assert.equal(resolveHiggsfieldCredentials(), null);
  });

  test("buildHiggsfieldAuthHeader builds official Key {id}:{secret} format", () => {
    const header = buildHiggsfieldAuthHeader({
      keyId: "test_id",
      keySecret: "test_secret",
    });
    assert.equal(header, "Key test_id:test_secret");
  });
});

describe("Higgsfield Aspect Ratio Mapping", () => {
  test("maps standard and alias aspect ratios", () => {
    assert.equal(mapHiggsfieldAspectRatio("9:16"), "9:16");
    assert.equal(mapHiggsfieldAspectRatio("vertical"), "9:16");
    assert.equal(mapHiggsfieldAspectRatio("portrait"), "9:16");
    assert.equal(mapHiggsfieldAspectRatio("16:9"), "16:9");
    assert.equal(mapHiggsfieldAspectRatio("horizontal"), "16:9");
    assert.equal(mapHiggsfieldAspectRatio("landscape"), "16:9");
    assert.equal(mapHiggsfieldAspectRatio("1:1"), "1:1");
    assert.equal(mapHiggsfieldAspectRatio("square"), "1:1");
    assert.equal(mapHiggsfieldAspectRatio("4:3"), "4:3");
    assert.equal(mapHiggsfieldAspectRatio("3:4"), "3:4");
    assert.equal(mapHiggsfieldAspectRatio(""), "9:16");
    assert.equal(mapHiggsfieldAspectRatio(undefined), "9:16");
  });
});

describe("Higgsfield Extraction Helpers", () => {
  test("firstImageUrl extracts from various response schemas", () => {
    assert.equal(firstImageUrl({ images: [{ url: "https://hf.ai/img1.png" }] }), "https://hf.ai/img1.png");
    assert.equal(firstImageUrl({ images: ["https://hf.ai/img2.png"] }), "https://hf.ai/img2.png");
    assert.equal(firstImageUrl({ image: { url: "https://hf.ai/img3.png" } }), "https://hf.ai/img3.png");
    assert.equal(firstImageUrl({ image: "https://hf.ai/img4.png" }), "https://hf.ai/img4.png");
    assert.equal(firstImageUrl({ output: [{ url: "https://hf.ai/img5.png" }] }), "https://hf.ai/img5.png");
    assert.equal(firstImageUrl({ url: "https://hf.ai/img6.png" }), "https://hf.ai/img6.png");
    assert.equal(firstImageUrl({}), "");
    assert.equal(firstImageUrl(null), "");
  });

  test("videoUrl extracts from various response schemas", () => {
    assert.equal(videoUrl({ video: { url: "https://hf.ai/vid1.mp4" } }), "https://hf.ai/vid1.mp4");
    assert.equal(videoUrl({ video: "https://hf.ai/vid2.mp4" }), "https://hf.ai/vid2.mp4");
    assert.equal(videoUrl({ videos: [{ url: "https://hf.ai/vid3.mp4" }] }), "https://hf.ai/vid3.mp4");
    assert.equal(videoUrl({ output: { video: { url: "https://hf.ai/vid4.mp4" } } }), "https://hf.ai/vid4.mp4");
    assert.equal(videoUrl({ output: [{ url: "https://hf.ai/vid5.mp4" }] }), "https://hf.ai/vid5.mp4");
    assert.equal(videoUrl({ video_url: "https://hf.ai/vid6.mp4" }), "https://hf.ai/vid6.mp4");
    assert.equal(videoUrl({ url: "https://hf.ai/vid7.mp4" }), "https://hf.ai/vid7.mp4");
    assert.equal(videoUrl({}), "");
    assert.equal(videoUrl(null), "");
  });
});

describe("Higgsfield Image & Video Generation Flow (Mocked)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("generateSoulImage submits to standard endpoint and polls until completed", async () => {
    let submitPayload: any = null;
    let pollCount = 0;

    globalThis.fetch = async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/higgsfield-ai/soul/v2/standard")) {
        submitPayload = JSON.parse(init.body);
        assert.equal(init.headers["Authorization"], "Key test_id:test_sec");
        return {
          ok: true,
          json: async () => ({
            request_id: "req_img_123",
            status: "queued",
          }),
        } as any;
      }
      if (url.includes("/requests/req_img_123/status")) {
        pollCount++;
        assert.equal(init.headers["Authorization"], "Key test_id:test_sec");
        return {
          ok: true,
          json: async () => ({
            status: "completed",
            images: [{ url: "https://api.higgsfield.ai/output/soul-result.png" }],
          }),
        } as any;
      }
      throw new Error("Unexpected fetch: " + url);
    };

    const result = await generateSoulImage(
      {
        prompt: "A neon-lit cyberpunk hero sword",
        aspectRatio: "9:16",
        resolution: "1080p",
      },
      "test_id:test_sec"
    );

    assert.equal(result, "https://api.higgsfield.ai/output/soul-result.png");
    assert.equal(submitPayload.prompt, "A neon-lit cyberpunk hero sword");
    assert.equal(submitPayload.aspect_ratio, "9:16");
    assert.equal(submitPayload.resolution, "1080p");
    assert.equal(pollCount, 1);
  });

  test("generateSoulImage routes cinema model to /higgsfield-ai/soul/cinema", async () => {
    let endpointCalled = "";

    globalThis.fetch = async (input: any, init?: any) => {
      endpointCalled = String(input);
      return {
        ok: true,
        json: async () => ({
          status: "completed",
          images: [{ url: "https://api.higgsfield.ai/output/cinema-result.png" }],
        }),
      } as any;
    };

    const result = await generateSoulImage(
      {
        prompt: "Cinematic shot",
        model: "soul-cinema",
      },
      "test_id:test_sec"
    );

    assert.equal(result, "https://api.higgsfield.ai/output/cinema-result.png");
    assert.ok(endpointCalled.includes("/higgsfield-ai/soul/cinema"));
  });

  test("generateSeedanceVideo submits to /bytedance/seedance-2.5/image-to-video", async () => {
    let submitPayload: any = null;

    globalThis.fetch = async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/bytedance/seedance-2.5/image-to-video")) {
        submitPayload = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            request_id: "req_vid_456",
            status: "queued",
          }),
        } as any;
      }
      if (url.includes("/requests/req_vid_456/status")) {
        return {
          ok: true,
          json: async () => ({
            status: "completed",
            video: { url: "https://api.higgsfield.ai/output/seedance.mp4" },
          }),
        } as any;
      }
      throw new Error("Unexpected fetch: " + url);
    };

    const result = await generateSeedanceVideo(
      {
        prompt: "Animate character moving forward",
        firstFrameUrl: "https://spark.storage.supabase.co/frames/still-1.jpg",
        durationSec: 5,
        resolution: "720p",
      },
      "test_id:test_sec"
    );

    assert.equal(result, "https://api.higgsfield.ai/output/seedance.mp4");
    assert.equal(submitPayload.image_url, "https://spark.storage.supabase.co/frames/still-1.jpg");
    assert.equal(submitPayload.duration, 5);
    assert.equal(submitPayload.resolution, "720p");
    assert.equal(submitPayload.output_format, "mp4");
  });

  test("generateSoulImage throws descriptive error on failed job status", async () => {
    globalThis.fetch = async (input: any) => {
      const url = String(input);
      if (url.includes("/higgsfield-ai/soul/")) {
        return {
          ok: true,
          json: async () => ({ request_id: "req_fail_789" }),
        } as any;
      }
      if (url.includes("/requests/req_fail_789/status")) {
        return {
          ok: true,
          json: async () => ({
            status: "failed",
            error: "Prompt violates safety guidelines",
          }),
        } as any;
      }
      throw new Error("Unexpected fetch: " + url);
    };

    await assert.rejects(
      async () => {
        await generateSoulImage({ prompt: "bad prompt" }, "test_id:test_sec");
      },
      {
        message: /Higgsfield job failed: Prompt violates safety guidelines/,
      }
    );
  });

  test("cancelHiggsfieldRequest calls /requests/{id}/cancel", async () => {
    let cancelCalled = false;

    globalThis.fetch = async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/requests/req_to_cancel/cancel") && init.method === "POST") {
        cancelCalled = true;
        return { ok: true } as any;
      }
      throw new Error("Unexpected fetch: " + url);
    };

    const ok = await cancelHiggsfieldRequest("req_to_cancel", "test_id:test_sec");
    assert.equal(ok, true);
    assert.equal(cancelCalled, true);
  });
});
