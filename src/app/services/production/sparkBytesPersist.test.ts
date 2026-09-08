import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isEphemeralMediaUrl,
  isSparkStorageUrl,
  isPersistableSparkMediaUrl,
  sanitizePersistedMediaUrl,
  extractSparkStoragePath,
} from "./productionAssetService";
import { requestProductionVideoClip } from "./productionVideoRequest";
import { brandProductionStoragePath } from "./brandProductionStoragePath";
import { domainProductionToInsert, domainReviewToInsert } from "../../backend/mappers/workspaceMappers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPARK_PUBLIC =
  "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/Spark/brands/brand-1/prod-1/video/clip-scene-01.mp4";
const SPARK_SIGNED =
  "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/sign/Spark/brands/brand-1/prod-1/video/master.mp4?token=abc";

describe("Spark byte persist contract", () => {
  it("flags provider hosts as ephemeral and never persistable", () => {
    assert.equal(isEphemeralMediaUrl("https://vidgen.x.ai/abc.mp4"), true);
    assert.equal(isEphemeralMediaUrl("https://generativelanguage.googleapis.com/v1/files/x"), true);
    assert.equal(isEphemeralMediaUrl("https://fal.media/files/x.mp4"), true);
    assert.equal(isPersistableSparkMediaUrl("https://vidgen.x.ai/abc.mp4"), false);
    assert.equal(sanitizePersistedMediaUrl("https://vidgen.x.ai/abc.mp4", SPARK_PUBLIC), SPARK_PUBLIC);
    assert.equal(sanitizePersistedMediaUrl("https://vidgen.x.ai/abc.mp4"), undefined);
  });

  it("treats Spark public/sign URLs as the durable identity", () => {
    assert.equal(isSparkStorageUrl(SPARK_PUBLIC), true);
    assert.equal(isSparkStorageUrl(SPARK_SIGNED), true);
    assert.equal(isPersistableSparkMediaUrl(SPARK_PUBLIC), true);
    assert.equal(extractSparkStoragePath(SPARK_PUBLIC), "brands/brand-1/prod-1/video/clip-scene-01.mp4");
    assert.equal(extractSparkStoragePath(SPARK_SIGNED), "brands/brand-1/prod-1/video/master.mp4");
  });

  it("uses brands/{brandId}/{productionId}/video/{clip|master}-* persist paths", () => {
    assert.equal(
      brandProductionStoragePath("brand-1", "prod-1", "video/clip-scene-01.mp4"),
      "brands/brand-1/prod-1/video/clip-scene-01.mp4"
    );
    assert.equal(
      brandProductionStoragePath("brand-1", "prod-1", "video/master.mp4"),
      "brands/brand-1/prod-1/video/master.mp4"
    );
  });

  it("requestProductionVideoClip rejects vidgen/googleapis as videoUrl", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: true,
          videoUrl: "https://vidgen.x.ai/generated.mp4",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    await assert.rejects(
      () =>
        requestProductionVideoClip({
          provider: "grok",
          prompt: "test",
          firstFrameUrl: "data:image/jpeg;base64,AAA",
        }),
      /provider URL|Spark storage/i
    );

    globalThis.fetch = originalFetch;
  });

  it("requestProductionVideoClip accepts a Spark public URL + storagePath", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: true,
          videoUrl: SPARK_PUBLIC,
          publicUrl: SPARK_PUBLIC,
          storagePath: "brands/brand-1/prod-1/video/clip-scene-01.mp4",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    const clip = await requestProductionVideoClip({
      provider: "grok",
      prompt: "test",
      firstFrameUrl: "data:image/jpeg;base64,AAA",
    });
    assert.equal(clip.videoUrl, SPARK_PUBLIC);
    assert.equal(clip.storagePath, "brands/brand-1/prod-1/video/clip-scene-01.mp4");
    assert.equal(isPersistableSparkMediaUrl(clip.videoUrl), true);

    globalThis.fetch = originalFetch;
  });
});

describe("server persist source contract", () => {
  it("video.ts finalizeClip no longer returns the provider URL on persist failure", () => {
    const videoSrc = fs.readFileSync(path.join(__dirname, "../../../../api/runtime/video.ts"), "utf8");
    assert.match(videoSrc, /from\s+["']\.\/_sparkStorage\.js["']/);
    assert.doesNotMatch(videoSrc, /returning provider URL/);
    assert.doesNotMatch(videoSrc, /persistedUrl \|\| params\.videoUrl/);
    assert.match(videoSrc, /storagePath: finalized\.storagePath/);
    assert.match(videoSrc, /filename:\s*["']master\.mp4["']/);
  });

  it("Spark persist helper prefers getPublicUrl and never uses a second bucket", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../../../api/runtime/_sparkStorage.ts"), "utf8");
    assert.match(src, /SPARK_STORAGE_BUCKET = "Spark"/);
    assert.match(src, /getPublicUrl/);
    assert.doesNotMatch(src, /\.from\(["']media["']\)/);
    assert.match(src, /brands\/\$\{bId\}\/\$\{prodId\}\/\$\{cleanSub\}/);
  });

  it("ingest-media endpoint fetches remote bytes and uploads to Spark", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../../../api/runtime/ingest-media.ts"), "utf8");
    assert.match(src, /persistBufferToSpark/);
    assert.match(src, /productionId is required/);
    assert.doesNotMatch(src, /videoUrl:\s*url/);
  });
});

describe("persist mappers never write provider URLs", () => {
  it("domainProductionToInsert drops vidgen/googleapis and keeps Spark + storage_path", () => {
    const row = domainProductionToInsert("brand-1", {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Test",
      status: "Ready for Review",
      mode: "standard",
      dateCreated: "2026-09-08",
      aspectRatio: "9:16",
      formats: ["Short-form"],
      scenes: [{ scene: 1, description: "hook", duration: "5s", videoUrl: "https://vidgen.x.ai/clip.mp4" }],
      videoUrl: "https://vidgen.x.ai/generated.mp4",
      videoStoragePath: "brands/brand-1/prod-1/video/master.mp4",
      brief: {
        title: "Test",
        productionMode: "standard",
        hook: "hook",
        scriptOutline: "",
        visualDirection: "",
        caption: "",
        platformRecommendation: "",
        whyThisWorks: "",
        brandFitScore: 1,
        suggestedDuration: "60s",
        videoUrl: "https://generativelanguage.googleapis.com/v1/files/x",
      },
    } as any);
    const assets = row.assets as Record<string, unknown>;
    const brief = row.brief as Record<string, unknown>;
    assert.notEqual(assets.video_url, "https://vidgen.x.ai/generated.mp4");
    assert.equal(assets.video_url, null);
    assert.equal(assets.video_storage_path, "brands/brand-1/prod-1/video/master.mp4");
    assert.equal(brief.videoUrl, undefined);
    const scenes = brief.scenes as Array<{ videoUrl?: string }>;
    assert.equal(scenes[0].videoUrl, undefined);
  });

  it("domainProductionToInsert keeps a Spark public URL as video_url", () => {
    const row = domainProductionToInsert("brand-1", {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Test",
      status: "Ready for Review",
      mode: "standard",
      dateCreated: "2026-09-08",
      aspectRatio: "9:16",
      formats: ["Short-form"],
      scenes: [],
      videoUrl: SPARK_PUBLIC,
      brief: {
        title: "Test",
        productionMode: "standard",
        hook: "hook",
        scriptOutline: "",
        visualDirection: "",
        caption: "",
        platformRecommendation: "",
        whyThisWorks: "",
        brandFitScore: 1,
        suggestedDuration: "60s",
        videoUrl: SPARK_PUBLIC,
      },
    } as any);
    const assets = row.assets as Record<string, unknown>;
    assert.equal(assets.video_url, SPARK_PUBLIC);
    assert.equal(assets.video_storage_path, "brands/brand-1/prod-1/video/clip-scene-01.mp4");
  });

  it("domainReviewToInsert drops provider videoUrl", () => {
    const row = domainReviewToInsert("brand-1", {
      id: "11111111-1111-4111-8111-111111111111",
      productionId: "22222222-2222-4222-8222-222222222222",
      title: "Review",
      account: "YouTube",
      series: "Series",
      status: "Pending Review",
      dateCreated: "2026-09-08",
      scriptSnippet: "",
      conceptText: "",
      openingMoment: "",
      qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" },
      videoUrl: "https://vidgen.x.ai/generated.mp4",
    });
    const reasoning = row.reasoning as Record<string, unknown>;
    assert.equal(reasoning.videoUrl, undefined);
  });
});
