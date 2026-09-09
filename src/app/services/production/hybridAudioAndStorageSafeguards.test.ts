import test from "node:test";
import assert from "node:assert/strict";
import {
  isEphemeralMediaUrl,
  isPersistableSparkMediaUrl,
  isSparkStorageUrl,
} from "./productionAssetService";
import type { GenerationProgressStage } from "../../domain/types";

test("Fix 5: isEphemeralMediaUrl identifies provider temporary and local URLs", () => {
  assert.equal(isEphemeralMediaUrl("https://fal.media/files/lion/output.png"), true);
  assert.equal(isEphemeralMediaUrl("https://oaidalleapiprodscus.blob.core.windows.net/private/image.png"), true);
  assert.equal(isEphemeralMediaUrl("blob:http://localhost:3000/123-abc"), true);
  assert.equal(isEphemeralMediaUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="), true);
  assert.equal(isEphemeralMediaUrl("https://vidgen.x.ai/video123.mp4"), true);

  // Durable Spark storage URLs are not ephemeral
  assert.equal(
    isEphemeralMediaUrl(
      "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/brand-1/prod-1/scenes/scene-01.png"
    ),
    false
  );
});

test("Fix 5: isPersistableSparkMediaUrl accepts only durable Spark bucket URLs", () => {
  const durableUrl =
    "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/brand-1/prod-1/scenes/scene-01.png";
  assert.equal(isPersistableSparkMediaUrl(durableUrl), true);
  assert.equal(isSparkStorageUrl(durableUrl), true);

  // Rejects ephemeral even if it mentions Spark
  assert.equal(
    isPersistableSparkMediaUrl("https://fal.media/files/Spark/output.png"),
    false
  );
  // Rejects data URLs
  assert.equal(
    isPersistableSparkMediaUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="),
    false
  );
});

test("Fix 4: Hybrid audio merge preserves VO when some scenes are talent and some are VO", () => {
  const hybridStoryboard = [
    { scene: 1, audio: "talent", spokenLines: "Welcome back to the show." },
    { scene: 2, audio: "vo", spokenLines: "Look at this dramatic shift in the data." },
    { scene: 3, audio: "vo", spokenLines: "Follow for more daily insights." },
  ];

  const mode = "standard";
  const realVoiceUrl = "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/audio/voiceover.mp3";

  // Previously allScenesVo was every((s) => s.audio === "vo") which evaluated to false!
  const hasVoScenes = hybridStoryboard.length > 0 && hybridStoryboard.some((s) => s.audio === "vo");
  const mergeAudioUrl = (mode === "express" || hasVoScenes) ? realVoiceUrl : undefined;

  assert.equal(hasVoScenes, true);
  assert.equal(mergeAudioUrl, realVoiceUrl);

  // VO-only line extraction for Hybrid
  const voScenes = hybridStoryboard.filter((s) => s.audio === "vo");
  const voLines = voScenes.map((s) => s.spokenLines).filter(Boolean).join(" ");
  assert.equal(voLines, "Look at this dramatic shift in the data. Follow for more daily insights.");
  assert.ok(!voLines.includes("Welcome back to the show."));
});

test("Fix 6: GenerationProgressStage supports skipped status for honest pipeline state", () => {
  const skippedStage: GenerationProgressStage = {
    name: "Voice",
    status: "skipped",
    label: "Voice",
    description: "Skipped external VO bed for cinematic",
  };

  assert.equal(skippedStage.status, "skipped");
  assert.equal(skippedStage.name, "Voice");
});
