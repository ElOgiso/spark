/** Phase 15 audio finishing on the existing visual master; no visual re-render or provider spend. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { FfmpegRenderPlan } from "../../src/app/services/production/editorial/mastering/ffmpegAdapter.js";
import { persistVideoBuffer } from "./_sparkStorage.js";

const exec = promisify(execFile);
type AudioInput = FfmpegRenderPlan["audioInputs"][number];
const finite = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;
const number = (value: number) => String(Math.round(value * 1000000) / 1000000);

export function validateAudioRenderPlan(plan: FfmpegRenderPlan): void {
  if (!plan || !Array.isArray(plan.audioInputs) || !Array.isArray(plan.concatInputs) || !Array.isArray(plan.audioMix) || plan.audioInputs.length + plan.concatInputs.length > 256 || plan.audioMix.length > 2048) throw new Error("Invalid or oversized audio render plan");
  if (![44100, 48000].includes(plan.audioTarget?.sampleRateHz) || ![1, 2].includes(plan.audioTarget?.channels) || plan.audioTarget.codec !== "aac") throw new Error("Audio mastering requires AAC at 44.1/48 kHz, mono/stereo");
  for (const input of plan.audioInputs) {
    if (!input.url || !input.trackId || !finite(input.sourceStartSec, 0, 14400) || !finite(input.sourceEndSec, 0, 14400) || input.sourceEndSec <= input.sourceStartSec || !finite(input.timelineStartSec, 0, 14400) || !finite(input.timelineEndSec, 0, 14400) || input.timelineEndSec <= input.timelineStartSec || !finite(input.volume, 0, 4) || input.playbackRate !== 1) throw new Error("Invalid audio source, placement or unsupported playback rate");
    if (input.voiceConversion && !input.voiceConversion.outputAssetId) throw new Error("Voice conversion output is required before mastering");
    if (!Array.isArray(input.volumeAutomation) || input.volumeAutomation.length > 512 || input.volumeAutomation.some(point => !finite(point.atSec, 0, 14400) || !finite(point.gainDb, -120, 12))) throw new Error("Invalid volume automation");
  }
  for (const mix of plan.audioMix) if (!["gain", "duck", "fade_in", "fade_out", "mute"].includes(mix.kind) || !finite(mix.startSec, 0, 14400) || !finite(mix.endSec, mix.startSec, 14400) || !finite(mix.gainDb, -120, 12) || (mix.duckDb != null && !finite(mix.duckDb, -120, 0))) throw new Error("Invalid audio mix instruction");
  for (const input of plan.concatInputs) if (!finite(input.startSec, 0, 14400) || !finite(input.endSec, input.startSec, 14400) || !finite(input.timelineStartSec, 0, 14400) || !finite(input.timelineEndSec, input.timelineStartSec, 14400) || input.playbackRate !== 1 || !finite(input.volume, 0, 4) || !Array.isArray(input.volumeAutomation) || input.volumeAutomation.some(point => !finite(point.atSec, 0, 14400) || !finite(point.gainDb, -120, 12))) throw new Error("Invalid native dialogue timing");
  if (plan.audioMastering && (!finite(plan.audioMastering.targetLufs, -30, -9) || !finite(plan.audioMastering.truePeakDbtp, -9, -0.1))) throw new Error("Invalid loudness target");
}

export function assertAudioStorageUrl(raw: string, storageOrigin: string, brandId: string, productionId: string): void {
  if (decodeURIComponent(raw).includes("/../")) throw new Error("Invalid media path");
  const url = new URL(raw);
  const suffix = decodeURIComponent(url.pathname).replace(/^\/storage\/v1\/object\/(?:public|sign)\/Spark\//, "");
  if (url.origin !== new URL(storageOrigin).origin || url.protocol !== "https:" || url.username || url.password || suffix === decodeURIComponent(url.pathname) || suffix.includes("..") || !(suffix.startsWith(`brands/${brandId}/${productionId}/`) || suffix.startsWith(`${productionId}/`))) throw new Error("Audio mastering requires durable media belonging to this production");
}

function gainExpression(input: AudioInput, mixes: FfmpegRenderPlan["audioMix"]): string {
  let automation = "0";
  for (const point of [...input.volumeAutomation].sort((a, b) => a.atSec - b.atSec)) automation = `if(gte(t,${number(point.atSec)}),${number(point.gainDb)},${automation})`;
  const own = mixes.filter(mix => mix.targetTrackId === input.trackId);
  const base = own.filter(mix => mix.kind === "gain").reduce((expr, mix) => `${expr}+if(between(t,${number(mix.startSec)},${number(mix.endSec)}),${number(mix.gainDb)},0)`, automation);
  const ducks = own.filter(mix => mix.kind === "duck").reduce((expr, mix) => `min(${expr},if(between(t,${number(mix.startSec)},${number(mix.endSec)}),${number(mix.duckDb ?? 0)},0))`, "0");
  const mutes = own.filter(mix => mix.kind === "mute").reduce((expr, mix) => `${expr}*if(between(t,${number(mix.startSec)},${number(mix.endSec)}),0,1)`, "1");
  return `${number(input.muted ? 0 : input.volume)}*pow(10,(${base}+${ducks})/20)*${mutes}`;
}

/** Pure numeric filter compiler: filenames and network URLs never enter the graph. */
export function buildAudioFilterGraph(inputs: AudioInput[], plan: FfmpegRenderPlan, durationSec: number): string {
  const chains: string[] = [];
  inputs.forEach((input, index) => {
    const rate = plan.audioTarget.sampleRateHz;
    const sampleCount = Math.max(1, Math.round((input.sourceEndSec - input.sourceStartSec) * rate));
    const filters = [`aresample=${rate}`, `atrim=start=${number(input.sourceStartSec)}:end=${number(input.sourceEndSec)}`, "asetpts=PTS-STARTPTS"];
    if (input.loop) filters.push(`aloop=loop=-1:size=${sampleCount}`);
    filters.push(`atrim=duration=${number(input.timelineEndSec - input.timelineStartSec)}`, `adelay=${Math.round(input.timelineStartSec * 1000)}:all=1`, `volume='${gainExpression(input, plan.audioMix)}':eval=frame`);
    for (const mix of plan.audioMix.filter(mix => mix.targetTrackId === input.trackId && (mix.kind === "fade_in" || mix.kind === "fade_out") && mix.endSec > mix.startSec)) filters.push(`afade=t=${mix.kind === "fade_in" ? "in" : "out"}:st=${number(mix.startSec)}:d=${number(mix.endSec - mix.startSec)}`);
    filters.push(`apad=whole_dur=${number(durationSec)}`, `atrim=duration=${number(durationSec)}`, `aformat=sample_rates=${rate}:channel_layouts=${plan.audioTarget.channels === 1 ? "mono" : "stereo"}`);
    chains.push(`[${index + 1}:a:0]${filters.join(",")}[a${index}]`);
  });
  const target = plan.audioMastering;
  const normalize = target ? `,loudnorm=I=${number(target.targetLufs)}:TP=${number(target.truePeakDbtp)}:LRA=11` : "";
  if (inputs.length) chains.push(`${inputs.map((_, i) => `[a${i}]`).join("")}amix=inputs=${inputs.length}:duration=longest:normalize=0${normalize},alimiter=limit=0.95:level=false,aresample=${plan.audioTarget.sampleRateHz}[aout]`);
  else chains.push(`anullsrc=r=${plan.audioTarget.sampleRateHz}:cl=${plan.audioTarget.channels === 1 ? "mono" : "stereo"},atrim=duration=${number(durationSec)}[aout]`);
  return chains.join(";");
}

export async function probeAudioMedia(file: string): Promise<{ durationSec: number; hasAudio: boolean }> {
  const { stdout } = await exec(ffprobe.path, ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file], { timeout: 15000 });
  const info = JSON.parse(stdout);
  const durationSec = Number(info.format?.duration);
  if (!finite(durationSec, 0.001, 14400)) throw new Error("Media duration could not be measured");
  return { durationSec, hasAudio: info.streams?.some((stream: { codec_type: string }) => stream.codec_type === "audio") === true };
}

export async function renderAudioMaster(params: { baseFile: string; inputFiles: string[]; inputs: AudioInput[]; plan: FfmpegRenderPlan; outputFile: string; durationSec: number }): Promise<void> {
  const argv = ["-y", "-protocol_whitelist", "file,pipe", "-i", params.baseFile];
  params.inputFiles.forEach(file => argv.push("-protocol_whitelist", "file,pipe", "-i", file));
  argv.push("-filter_complex", buildAudioFilterGraph(params.inputs, params.plan, params.durationSec), "-map", "0:v:0", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-ar", String(params.plan.audioTarget.sampleRateHz), "-ac", String(params.plan.audioTarget.channels), "-t", String(params.durationSec), "-movflags", "+faststart", params.outputFile);
  await exec(ffmpegPath!, argv, { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
}

export async function handleAudioMaster(req: VercelRequest, res: VercelResponse) {
  let folder: string | undefined;
  try {
    const { plan, masterUrl, brandId, productionId } = req.body as { plan: FfmpegRenderPlan; masterUrl: string; brandId: string; productionId: string };
    if (![brandId, productionId].every(id => typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id))) throw new Error("Brand and production identity required");
    validateAudioRenderPlan(plan);
    const origin = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!origin) throw new Error("Storage is not configured");
    assertAudioStorageUrl(masterUrl, origin, brandId, productionId);
    [...plan.concatInputs, ...plan.audioInputs].forEach(input => assertAudioStorageUrl(input.url, origin, brandId, productionId));
    folder = await fs.mkdtemp(path.join(os.tmpdir(), "spark-audio-"));
    const files = new Map<string, string>(); let totalBytes = 0;
    const download = async (url: string) => {
      if (files.has(url)) return files.get(url)!;
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
      if (!response.ok || Number(response.headers.get("content-length")) > 256 * 1024 * 1024) throw new Error("Audio mastering media download failed or exceeded size limit");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Empty media response");
      const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; totalBytes += value.byteLength; if (totalBytes > 512 * 1024 * 1024) { await reader.cancel(); throw new Error("Audio mastering media budget exceeded"); } chunks.push(value); }
      const file = path.join(folder!, `source_${files.size}`);
      await fs.writeFile(file, Buffer.concat(chunks)); files.set(url, file); return file;
    };
    const baseFile = await download(masterUrl);
    const base = await probeAudioMedia(baseFile);
    const plannedEnd = Math.max(...plan.concatInputs.map(input => input.timelineEndSec));
    if (!Number.isFinite(plannedEnd) || Math.abs(base.durationSec - plannedEnd) > 0.25) throw new Error("Visual master duration differs from audio timeline; retime before finishing");
    const inputs = plan.audioInputs.filter(input => !input.embedded && !input.muted);
    for (const clip of plan.concatInputs.filter(input => input.mediaType === "video" && !input.muted)) {
      const embedded = plan.audioInputs.find(input => input.embedded && input.url === clip.url && input.timelineStartSec === clip.timelineStartSec);
      if (embedded?.muted) continue;
      if (embedded) { inputs.push({ ...embedded, embedded: false }); continue; }
      const file = await download(clip.url); const probe = await probeAudioMedia(file);
      if (!probe.hasAudio) continue;
      inputs.push({ url: clip.url, clipId: clip.clipId, trackId: `native_${clip.clipId}`, role: "native", sourceStartSec: clip.startSec, sourceEndSec: Math.min(clip.endSec, probe.durationSec), timelineStartSec: clip.timelineStartSec, timelineEndSec: clip.timelineEndSec, volume: clip.volume, muted: false, loop: false, embedded: false, playbackRate: clip.playbackRate, volumeAutomation: clip.volumeAutomation });
    }
    const inputFiles: string[] = [];
    for (const input of inputs) {
      const file = await download(input.url); const probe = await probeAudioMedia(file);
      if (!probe.hasAudio || input.sourceStartSec >= probe.durationSec || input.sourceEndSec > probe.durationSec + 0.1 || input.timelineEndSec > base.durationSec + 0.1) throw new Error(`Audio source timing is invalid for ${input.clipId}`);
      inputFiles.push(file);
    }
    const outputFile = path.join(folder, "master.mp4");
    await renderAudioMaster({ baseFile, inputFiles, inputs, plan, outputFile, durationSec: base.durationSec });
    const output = await probeAudioMedia(outputFile);
    if (!output.hasAudio || Math.abs(output.durationSec - base.durationSec) > 0.15) throw new Error("Audio master failed media verification");
    let audioMeasurements: Record<string, unknown> | undefined;
    if (plan.audioMastering) {
      const { stderr } = await exec(ffmpegPath!, ["-hide_banner", "-protocol_whitelist", "file,pipe", "-i", outputFile, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
      const payload = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/)?.[0];
      const measured = payload ? JSON.parse(payload) : {};
      const integratedLufs = Number(measured.input_i); const truePeakDbtp = Number(measured.input_tp);
      if (!Number.isFinite(integratedLufs) || !Number.isFinite(truePeakDbtp) || Math.abs(integratedLufs - plan.audioMastering.targetLufs) > 1 || truePeakDbtp > plan.audioMastering.truePeakDbtp + 0.3) throw new Error("Audio master failed measured loudness/peak verification");
      audioMeasurements = { integratedLufs, truePeakDbtp };
    }
    const buffer = await fs.readFile(outputFile);
    const hash = crypto.createHash("sha256").update(JSON.stringify({ masterUrl, plan })).digest("hex").slice(0, 16);
    const stored = await persistVideoBuffer({ buffer, brandId, productionId, filename: `audio-master-${hash}.mp4` });
    return res.status(200).json({ success: true, videoUrl: stored.publicUrl, durationSec: output.durationSec, fileSizeBytes: buffer.length, audioVerified: true, audioMeasurements });
  } catch (error) {
    const unavailable = (error as NodeJS.ErrnoException)?.code === "ENOENT";
    return res.status(unavailable ? 503 : 422).json({ success: false, error: unavailable ? "AUDIO_RUNTIME_UNAVAILABLE" : "AUDIO_MASTER_FAILED", message: unavailable ? "FFmpeg/ffprobe are unavailable on the server" : (error as Error).message });
  } finally { if (folder) await fs.rm(folder, { recursive: true, force: true }); }
}
