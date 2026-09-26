import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { HiggsfieldPayloadTranslator } from "./higgsfield";
import { ProviderPayloadCompiler } from "../payloadCompiler";
import { compileReferences } from "../referenceCompiler";
import { getCapabilityProfile } from "../../capability/registry";
import type { ShotSpec } from "../../specification/shotSpec";
import type { CompiledMediaInput, NormalizedGenerationParameters } from "../types";
import { buildHiggsfieldSeedanceR2vBody } from "../../../../../../api/runtime/_videoContract";

const params: NormalizedGenerationParameters = {
  aspectRatio: "9:16",
  resolution: "720p",
  durationSec: 5,
  generateAudio: true,
};

function media(role: CompiledMediaInput["role"], url: string): CompiledMediaInput {
  return { role, url, importance: "required" };
}

describe("Higgsfield payload roles", () => {
  const translator = new HiggsfieldPayloadTranslator();

  it("maps a start frame to image-to-video and does not attach image_urls", () => {
    const result = translator.translate(
      { modelId: "seedance-2.5-i2v" } as any,
      {
        prompt: "slow push in",
        mediaInputs: [
          media("first_frame", "https://cdn.spark.test/still.png"),
          media("last_frame", "https://cdn.spark.test/end.png"),
          media("character_reference", "https://cdn.spark.test/hero.png"),
        ],
        normalizedParams: params,
      }
    );

    assert.equal(result.operation, "image_to_video");
    assert.equal(result.validation.valid, true);
    assert.equal(result.rawPayload.image_url, "https://cdn.spark.test/still.png");
    assert.equal(result.rawPayload.end_image_url, "https://cdn.spark.test/end.png");
    assert.equal(result.rawPayload.image_urls, undefined);
    assert.ok(result.validation.warnings.some((w) => w.startsWith("HF_I2V_REFERENCE_NOT_ON_WIRE")));
  });

  it("fails closed instead of inventing text-to-video when the i2v model has no start frame", () => {
    const result = translator.translate(
      { modelId: "seedance-2.5-i2v" } as any,
      {
        prompt: "no still",
        mediaInputs: [media("character_reference", "https://cdn.spark.test/hero.png")],
        normalizedParams: params,
      }
    );

    assert.equal(result.operation, "image_to_video");
    assert.equal(result.validation.valid, false);
    assert.match(result.validation.errors.join(" "), /not substituted/i);
    assert.equal(result.rawPayload.image_url, undefined);
    assert.equal(result.rawPayload.image_urls, undefined);
  });

  it("maps an explicit r2v model to reference-to-video fields", () => {
    const result = translator.translate(
      { modelId: "seedance-2.5-r2v" } as any,
      {
        prompt: "keep the face",
        mediaInputs: [
          media("character_reference", "https://cdn.spark.test/hero.png"),
          media("reference_image", "https://cdn.spark.test/street.png"),
          media("source_video", "https://cdn.spark.test/motion.mp4"),
          media("audio_track", "https://cdn.spark.test/room.wav"),
          media("source_video", "https://www.youtube.com/watch?v=abc"),
        ],
        normalizedParams: params,
      }
    );

    assert.equal(result.operation, "reference_to_video");
    assert.equal(result.validation.valid, true);
    assert.deepEqual(result.rawPayload.image_urls, [
      "https://cdn.spark.test/hero.png",
      "https://cdn.spark.test/street.png",
    ]);
    assert.deepEqual(result.rawPayload.video_urls, ["https://cdn.spark.test/motion.mp4"]);
    assert.deepEqual(result.rawPayload.audio_urls, ["https://cdn.spark.test/room.wav"]);
    assert.equal(result.rawPayload.image_url, undefined);
    assert.equal(result.rawPayload.aspect_ratio, "9:16");
  });

  it("does not compile a watch page as a provider video input", () => {
    const profile = getCapabilityProfile("higgsfield", "seedance-2.5-r2v");
    assert.ok(profile);
    const compiled = compileReferences({
      shot: {
        references: { characterRefs: [], locationRefs: [], styleRefs: [] },
        semanticReferences: [],
      } as unknown as ShotSpec,
      referenceGraph: {
        nodes: [
          {
            id: "vid",
            type: "SOURCE_VIDEO",
            role: "PREFERRED",
            scope: "PRODUCTION",
            url: "https://www.youtube.com/watch?v=abc",
          },
          {
            id: "clip",
            type: "SOURCE_VIDEO",
            role: "PREFERRED",
            scope: "PRODUCTION",
            url: "https://cdn.spark.test/plates/move.mp4",
          },
        ],
      } as any,
      capabilityProfile: profile!,
    });

    assert.equal(compiled.inputs.some((input) => input.url.includes("youtube.com")), false);
    assert.equal(compiled.inputs.some((input) => input.role === "source_video"), true);
    assert.ok(compiled.warnings.some((warning) => warning.startsWith("SOURCE_VIDEO_NOT_A_MEDIA_URL")));
  });

  it("compiler rejects higgsfield i2v with no start frame", () => {
    const profile = getCapabilityProfile("higgsfield", "seedance-2.5-i2v");
    assert.ok(profile);
    const result = ProviderPayloadCompiler.compile({
      shot: {
        id: "shot_hf",
        sceneId: "scene_1",
        index: 0,
        purpose: "approach",
        productionReason: "test",
        durationSec: 5,
        timingStartSec: 0,
        generationStrategy: "image_to_video",
        generationStatus: "planned",
        qcStatus: "pending",
        camera: { shotType: "medium", framing: "medium", cameraMovement: "push_in" },
        subject: "character",
        subjectAction: "walks",
        environment: "street",
        references: { characterRefs: ["https://cdn.spark.test/hero.png"], locationRefs: [], styleRefs: [] },
        continuityRequirements: [],
        characterIds: [],
        propIds: [],
        assetIds: [],
      } as ShotSpec,
      capabilityProfile: profile!,
      providerId: "higgsfield",
      modelId: "seedance-2.5-i2v",
    });

    assert.equal(result.operation, "image_to_video");
    assert.equal(result.validation.valid, false);
    assert.equal(result.rawPayload.image_urls, undefined);
  });
});

describe("Higgsfield R2V contract body", () => {
  it("adds direct video and audio urls without accepting a watch page", () => {
    const body = buildHiggsfieldSeedanceR2vBody({
      prompt: "hold identity",
      model: "seedance-2.5-r2v",
      imageUrls: ["https://cdn.spark.test/hero.png"],
      aspectRatio: "9:16",
      durationSec: 5,
      videoUrls: ["https://cdn.spark.test/motion.mp4", "https://youtu.be/abc"],
      audioUrls: ["https://cdn.spark.test/bed.mp3"],
    });
    assert.deepEqual(body.video_urls, ["https://cdn.spark.test/motion.mp4"]);
    assert.deepEqual(body.audio_urls, ["https://cdn.spark.test/bed.mp3"]);
    assert.equal((body as any).image_url, undefined);
  });
});
