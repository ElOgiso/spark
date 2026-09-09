import assert from "node:assert/strict";
import test from "node:test";
import { requestProductionVideoClip } from "./productionVideoRequest";

test("requestProductionVideoClip passes referenceImageUrls in request body for multi-ref providers", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: any = null;

  globalThis.fetch = (async (_url: any, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body || "{}"));
    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/clip-scene-01.mp4",
        storagePath: "brands/b1/p1/video/clip-scene-01.mp4",
        provider: "kling",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const charSheet = "https://xyz.supabase.co/storage/v1/object/public/Spark/characters/sheet-01.png";
    const locationPlate = "https://xyz.supabase.co/storage/v1/object/public/Spark/locations/plate-01.png";

    await requestProductionVideoClip({
      provider: "kling",
      prompt: "Host speaks with confident gestures in office",
      firstFrameUrl: "https://xyz.supabase.co/storage/v1/object/public/Spark/scenes/scene-01.png",
      referenceImageUrls: [charSheet, locationPlate],
      aspectRatio: "9:16",
      durationSec: 5,
    });

    assert.ok(capturedBody);
    assert.equal(capturedBody.provider, "kling");
    assert.deepEqual(capturedBody.referenceImageUrls, [charSheet, locationPlate]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestProductionVideoClip respects provider capability stripping for grok/xai", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: any = null;

  globalThis.fetch = (async (_url: any, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body || "{}"));
    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/clip-scene-01.mp4",
        storagePath: "brands/b1/p1/video/clip-scene-01.mp4",
        provider: "grok",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const charSheet = "https://xyz.supabase.co/storage/v1/object/public/Spark/characters/sheet-01.png";

    await requestProductionVideoClip({
      provider: "grok",
      prompt: "Host speaks with confident gestures",
      firstFrameUrl: "https://xyz.supabase.co/storage/v1/object/public/Spark/scenes/scene-01.png",
      referenceImageUrls: [charSheet],
      aspectRatio: "9:16",
      durationSec: 5,
    });

    assert.ok(capturedBody);
    assert.equal(capturedBody.provider, "grok");
    // Grok does not take multi-image reference inputs, so capability guard ensures []
    assert.deepEqual(capturedBody.referenceImageUrls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
