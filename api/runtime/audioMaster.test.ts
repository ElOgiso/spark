import test from "node:test";
import ffmpegPath from "ffmpeg-static";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateAudioRenderPlan, assertAudioStorageUrl, buildAudioFilterGraph, renderAudioMaster, probeAudioMedia } from "./_audioMaster.js";
import type { FfmpegRenderPlan } from "../../src/app/services/production/editorial/mastering/ffmpegAdapter";

function plan(): FfmpegRenderPlan {
  return { adapterId: "ffmpeg", concatInputs: [], audioInputs: [], audioMix: [], transitions: [], captions: [], suggestedFilterGraphNotes: [], audioTarget: { sampleRateHz: 48000, channels: 2, codec: "aac" }, output: { width: 64, height: 64, frameRate: 30, codec: "h264", container: "mp4", aspectRatio: "1:1" } };
}
function input(): FfmpegRenderPlan["audioInputs"][number] {
  return { url: "https://project.supabase.co/storage/v1/object/public/Spark/brands/b/p/audio/voice.wav", clipId: "voice", trackId: "n", role: "narration", sourceStartSec: 0, sourceEndSec: 1, timelineStartSec: 1, timelineEndSec: 2, volume: 1, muted: false, loop: false, embedded: false, playbackRate: 1, volumeAutomation: [] };
}

test("Phase 15 runtime restricts media to the authorized production storage path", () => {
  const origin = "https://project.supabase.co";
  assert.doesNotThrow(() => assertAudioStorageUrl(input().url, origin, "b", "p"));
  for (const url of ["http://127.0.0.1/private", input().url.replace("brands/b/p", "brands/other/p"), input().url.replace("project.supabase.co", "attacker.test"), input().url.replace("voice.wav", "%2e%2e/other.wav")]) assert.throws(() => assertAudioStorageUrl(url, origin, "b", "p"));
});

test("Phase 15 runtime rejects malformed timing, filter injection, and unconverted voice", () => {
  const p = plan(); p.audioInputs = [input()]; validateAudioRenderPlan(p);
  p.audioInputs[0].volume = NaN; assert.throws(() => validateAudioRenderPlan(p));
  p.audioInputs[0] = { ...input(), sourceStartSec: '0;movie=http://evil' as any }; assert.throws(() => validateAudioRenderPlan(p));
  p.audioInputs[0] = { ...input(), voiceConversion: { sourceAssetId: "src", targetVoiceRef: "voice" } }; assert.throws(() => validateAudioRenderPlan(p), /conversion output/);
});

test("Phase 15 real FFmpeg places trimmed narration without copying the previous master audio", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spark-audio-test-"));
  try {
    const baseFile = join(dir, "base.mp4"); const speech = join(dir, "voice.wav"); const outputFile = join(dir, "out.mp4");
    execFileSync(ffmpegPath!, ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=30:d=2", "-f", "lavfi", "-i", "sine=frequency=300:duration=2", "-c:v", "libx264", "-c:a", "aac", "-shortest", baseFile]);
    execFileSync(ffmpegPath!, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=1000:duration=1", speech]);
    const p = plan(); p.audioInputs = [input()];
    await renderAudioMaster({ baseFile, inputFiles: [speech], inputs: p.audioInputs, plan: p, outputFile, durationSec: 2 });
    const probe = await probeAudioMedia(outputFile); assert.equal(probe.hasAudio, true); assert.ok(Math.abs(probe.durationSec - 2) < .1);
    const pcm = execFileSync(ffmpegPath!, ["-v", "error", "-i", outputFile, "-map", "0:a:0", "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"]);
    const rms = (start: number, end: number) => { let total = 0; let count = 0; for (let i = Math.floor(start * 48000); i < Math.floor(end * 48000); i++) { total += pcm.readFloatLE(i * 4) ** 2; count++; } return Math.sqrt(total / count); };
    assert.ok(rms(.2, .8) < .001, "old baked-in audio must be removed");
    assert.ok(rms(1.2, 1.8) > .02, "narration must start at its planned offset");
    const sourceHash = execFileSync(ffmpegPath!, ["-v", "error", "-i", baseFile, "-map", "0:v:0", "-c", "copy", "-f", "hash", "pipe:1"]).toString();
    const finalHash = execFileSync(ffmpegPath!, ["-v", "error", "-i", outputFile, "-map", "0:v:0", "-c", "copy", "-f", "hash", "pipe:1"]).toString();
    assert.equal(finalHash, sourceHash, "Phase 14 visual stream remains unchanged");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Phase 15 real FFmpeg loops music and ducks it over speech windows", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spark-mix-test-"));
  try {
    const baseFile = join(dir, "base.mp4"); const music = join(dir, "music.wav"); const outputFile = join(dir, "out.mp4");
    execFileSync(ffmpegPath!, ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=30:d=2", "-c:v", "libx264", baseFile]);
    execFileSync(ffmpegPath!, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=600:duration=0.25", music]);
    const p = plan(); p.audioInputs = [{ ...input(), role: "music", trackId: "m", sourceEndSec: .25, timelineStartSec: 0, loop: true }];
    p.audioMix = [{ kind: "duck", gainDb: 0, startSec: 1, endSec: 2, targetTrackId: "m", triggerTrackId: "n", duckDb: -20, priority: 50 }];
    await renderAudioMaster({ baseFile, inputFiles: [music], inputs: p.audioInputs, plan: p, outputFile, durationSec: 2 });
    const pcm = execFileSync(ffmpegPath!, ["-v", "error", "-i", outputFile, "-map", "0:a:0", "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"]);
    const energy = (start: number) => { let total = 0; for (let i = start; i < start + 12000; i++) total += pcm.readFloatLE(i * 4) ** 2; return total; };
    assert.ok(energy(24000) > 1, "loop remains audible after the original ends");
    assert.ok(energy(60000) < energy(24000) * .03, "ducking is applied to actual audio");
    assert.ok(buildAudioFilterGraph(p.audioInputs, p, 2).includes("aloop"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
