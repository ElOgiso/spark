/**
 * Phase 1 — Video runtime boundary regression tests.
 * Protects ESM module resolution + fail-loud client contract behavior.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  resolveClipFrames,
  buildGrokVideoGenerateBody,
  buildKlingImage2VideoBody,
  snapKlingDuration,
} from "./_videoContract.js";
import {
  requestProductionVideoClip,
  isI2vApiProvider,
} from "../../src/app/services/production/productionVideoRequest.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("video.ts imports _videoContract with an ESM-compatible .js specifier", () => {
  const videoSrc = fs.readFileSync(path.join(__dirname, "video.ts"), "utf8");
  assert.match(
    videoSrc,
    /from\s+["']\.\/_videoContract\.js["']/,
    "api/runtime/video.ts must import ./_videoContract.js for Node ESM / Vercel resolution"
  );
  assert.doesNotMatch(
    videoSrc,
    /from\s+["']\.\/_videoContract["']/,
    "extensionless ./_videoContract import is unsafe under package type:module"
  );
});

test("video contract module loads and preserves start/end frame fields", async () => {
  const modUrl = pathToFileURL(path.join(__dirname, "_videoContract.ts")).href;
  const mod = await import(modUrl);
  assert.equal(typeof mod.resolveClipFrames, "function");
  assert.equal(typeof mod.buildGrokVideoGenerateBody, "function");

  const frames = resolveClipFrames({
    prompt: "slow push-in",
    firstFrameUrl: "data:image/jpeg;base64,AAA",
    endFrameUrl: "data:image/jpeg;base64,BBB",
    durationSec: 5,
    aspectRatio: "9:16",
  });
  assert.equal(frames.firstFrameUrl, "data:image/jpeg;base64,AAA");
  assert.equal(frames.endFrameUrl, "data:image/jpeg;base64,BBB");

  const grokBody = buildGrokVideoGenerateBody({
    prompt: "slow push-in",
    firstFrameDataUri: frames.firstFrameUrl,
    lastFrameDataUri: frames.endFrameUrl,
    durationSec: 5,
  });
  assert.ok(grokBody);
  assert.equal(typeof grokBody.prompt, "string");
  assert.equal(grokBody.image_url, frames.firstFrameUrl);

  const klingBody = buildKlingImage2VideoBody({
    prompt: "slow push-in",
    firstFrameDataUri: frames.firstFrameUrl,
    lastFrameDataUri: frames.endFrameUrl,
    durationSec: 5,
    klingMode: "pro",
  });
  assert.equal(klingBody.duration, snapKlingDuration(5));
  assert.equal(klingBody.image_tail, "BBB");
});

test("video.ts Grok in-process poll stays under serverless maxDuration", () => {
  const videoSrc = fs.readFileSync(path.join(__dirname, "video.ts"), "utf8");
  assert.match(videoSrc, /maxDuration:\s*300/);
  assert.match(videoSrc, /GROK_IN_PROCESS_POLL_MS\s*=\s*4\s*\*\s*60\s*\*\s*1000/);
  assert.match(videoSrc, /while\s*\(\s*Date\.now\(\)\s*-\s*started\s*<\s*GROK_IN_PROCESS_POLL_MS\s*\)/);
});

test("requestProductionVideoClip fails loudly on HTTP errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "provider unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  await assert.rejects(
    () =>
      requestProductionVideoClip({
        provider: "grok",
        prompt: "test",
        firstFrameUrl: "data:image/jpeg;base64,AAA",
      }),
    /provider unavailable|Video adapter failed \(503\)/i
  );

  globalThis.fetch = originalFetch;
});

test("requestProductionVideoClip fails loudly when success=false even on HTTP 200", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        success: false,
        fallbackToClient: true,
        error: "Serverless FFmpeg unavailable",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;

  await assert.rejects(
    () =>
      requestProductionVideoClip({
        provider: "mux",
        prompt: "concat",
        firstFrameUrl: "data:image/jpeg;base64,AAA",
      }),
    /success=false|Serverless FFmpeg unavailable/i
  );

  globalThis.fetch = originalFetch;
});

test("requestProductionVideoClip fails loudly when HTTP 200 has no videoUrl", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  await assert.rejects(
    () =>
      requestProductionVideoClip({
        provider: "grok",
        prompt: "test",
        firstFrameUrl: "data:image/jpeg;base64,AAA",
      }),
    /no videoUrl/i
  );

  globalThis.fetch = originalFetch;
});

test("I2V provider detection remains centralized for known adapters", () => {
  assert.equal(isI2vApiProvider("grok"), true);
  assert.equal(isI2vApiProvider("kling"), true);
  assert.equal(isI2vApiProvider("seedance"), true);
  assert.equal(isI2vApiProvider("gemini"), false);
  assert.equal(isI2vApiProvider("veo"), false);
});
