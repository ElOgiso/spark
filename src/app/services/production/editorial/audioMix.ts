/**
 * Deterministic audio mix instructions — authoritative representation, not a DSP engine.
 */

import type { EditorialTimeline, AudioMixInstruction, EditorialTrack } from "./types";
import { secToFrames } from "./timebase";

export function buildAudioMixInstructions(params: {
  timeline: Pick<EditorialTimeline, "tracks" | "durationFrames" | "frameRate">;
  hasMusic: boolean;
  duckNarrationUnderDb?: number;
  musicBedGainDb?: number;
}): AudioMixInstruction[] {
  const { timeline, hasMusic } = params;
  const duckDb = params.duckNarrationUnderDb ?? -8;
  const musicGain = params.musicBedGainDb ?? -9;
  const instructions: AudioMixInstruction[] = [];

  const audible = timeline.tracks.filter(track => !track.muted && (!timeline.tracks.some(item => item.solo) || track.solo));
  const speech = audible.filter(track => track.kind === "dialogue" || track.kind === "narration");
  for (const music of audible.filter(track => track.kind === "music" && hasMusic)) {
    instructions.push({ id: `gain_${music.id}`, kind: "gain", targetTrackId: music.id, startFrames: 0, endFrames: timeline.durationFrames, gainDb: musicGain, priority: 10 });
    instructions.push({ id: `fade_in_${music.id}`, kind: "fade_in", targetTrackId: music.id, startFrames: 0, endFrames: Math.min(timeline.durationFrames, secToFrames(1.2, timeline.frameRate)), gainDb: musicGain, priority: 20 });
    instructions.push({ id: `fade_out_${music.id}`, kind: "fade_out", targetTrackId: music.id, startFrames: Math.max(0, timeline.durationFrames - secToFrames(1.5, timeline.frameRate)), endFrames: timeline.durationFrames, gainDb: musicGain, priority: 20 });
    for (const voice of speech) for (const clip of voice.clips.filter(item => !item.muted && item.volume > 0)) {
      const start = Math.max(0, clip.timelineStartFrames);
      const end = Math.min(timeline.durationFrames, clip.timelineEndFrames);
      if (end <= start) continue;
      instructions.push({ id: `duck_${music.id}_${clip.id}`, kind: "duck", targetTrackId: music.id, triggerTrackId: voice.id, startFrames: start, endFrames: end, gainDb: musicGain, duckDb: voice.kind === "narration" ? duckDb - 2 : duckDb, priority: voice.kind === "narration" ? 60 : 50 });
    }
  }
  for (const ambience of audible.filter(track => track.kind === "ambience" && track.clips.length)) {
    instructions.push({ id: `gain_${ambience.id}`, kind: "gain", targetTrackId: ambience.id, startFrames: 0, endFrames: timeline.durationFrames, gainDb: -14, priority: 5 });
  }

  return instructions;
}

export function trackHasAudio(tracks: EditorialTrack[], kind: EditorialTrack["kind"]): boolean {
  return tracks.some((t) => t.kind === kind && t.clips.length > 0);
}

import type { ProductionAsset } from "../../../domain/types";
import type { ProductionSpec } from "../specification/productionSpec";
import type { AudioRole, AudioTrackPlan } from "../specification/audioSpec";
import type { EditorialScene, EditorialClip, UnresolvedDependency } from "./types";
import { ensureTrack } from "./tracks";
import { identityTransform, parseDurationToSec } from "./timebase";

/** Resolve persisted audio identity without mistaking music/SFX for speech. */
export function audioAssetRole(asset: ProductionAsset): AudioRole | undefined {
  const raw = asset.role || asset.generationSettings?.audioRole || asset.generationSettings?.kind;
  if (raw === "voice" || raw === "voiceover") return "narration";
  if (["narration", "dialogue", "music", "sfx", "ambience"].includes(raw)) return raw as AudioRole;
  if (/\/voice\./i.test(asset.storagePath || "") || /_voice$/.test(asset.taskId || "")) return "narration";
  if (/\/sfx\./i.test(asset.storagePath || "")) return "sfx";
  return undefined;
}

/** Audio Director extends the existing editorial assembly; it never submits generation. */
export function assembleAudioTracks(params: {
  spec: ProductionSpec;
  assets: ProductionAsset[];
  tracks: EditorialTrack[];
  scenes: EditorialScene[];
  frameRate: number;
  durationFrames: number;
  allowPlanned: boolean;
}): { unresolved: UnresolvedDependency[]; assetIds: string[] } {
  const { spec, tracks, scenes, frameRate, durationFrames, allowPlanned } = params;
  const unresolved: UnresolvedDependency[] = [];
  const assetIds: string[] = [];
  const assets = params.assets.filter(asset => asset.productionId === spec.project.id && asset.status === "completed" && asset.publicUrl);
  const videoClips = tracks.filter(track => track.kind === "video").flatMap(track => track.clips);
  const plans = spec.audio.tracks.flatMap(plan => {
    // Keep the existing scene ambience/SFX cues on their scene, not at frame zero.
    if (!plan.sceneId && !plan.shotId && !plan.assetId && plan.startSec == null && plan.endSec == null && (plan.id === "ambience" || plan.id === "sfx")) {
      const cues = spec.scenes.flatMap(scene => {
        const descriptions = plan.kind === "ambience" ? (scene.ambience ? [scene.ambience] : []) : scene.soundEffects || [];
        return descriptions.map((description, index) => ({ ...plan, id: `${plan.id}_${scene.id}_${index}`, sceneId: scene.id, description }));
      });
      if (cues.length) return cues;
    }
    return [plan];
  });
  const enabled: Array<[AudioRole, boolean]> = [["narration", spec.audio.hasNarration], ["dialogue", spec.audio.hasDialogue], ["music", spec.audio.hasMusic], ["ambience", spec.audio.hasAmbience], ["sfx", spec.audio.hasSfx]];
  for (const [kind, required] of enabled) {
    if (required && !plans.some(plan => plan.kind === kind)) plans.push({ id: `${kind}_primary`, kind, description: kind, mandatory: kind === "narration" || kind === "dialogue" });
  }
  const problem = (plan: AudioTrackPlan, message: string) => {
    if (!allowPlanned && plan.mandatory) unresolved.push({ kind: "missing_audio", sceneId: plan.sceneId, shotId: plan.shotId, message: `${plan.id}: ${message}` });
  };
  for (const plan of plans) {
    const speech = plan.kind === "narration" || plan.kind === "dialogue";
    if (plan.voiceConversion && !speech) {
      problem(plan, "Voice conversion requires a speech track");
      continue;
    }
    let ranges: Array<{ start: number; end: number; sceneId?: string; shotId?: string }> = [];
    if (plan.shotId) {
      ranges = videoClips.filter(clip => clip.shotId === plan.shotId && (!plan.sceneId || clip.sceneId === plan.sceneId)).map(clip => ({ start: clip.timelineStartFrames, end: clip.timelineEndFrames, sceneId: clip.sceneId, shotId: clip.shotId }));
    } else if (plan.sceneId) {
      ranges = scenes.filter(scene => scene.sceneSpecId === plan.sceneId).map(scene => ({ start: scene.startFrames, end: scene.startFrames + scene.durationFrames, sceneId: scene.sceneSpecId }));
    } else if (speech && plan.startSec == null && plan.endSec == null) {
      ranges = scenes.filter(scene => {
        const source = spec.scenes.find(item => item.id === scene.sceneSpecId);
        return source && (plan.kind === "narration" ? source.narration || source.shots.some(shot => shot.narration) : source.dialogue || source.shots.some(shot => shot.dialogue));
      }).map(scene => ({ start: scene.startFrames, end: scene.startFrames + scene.durationFrames, sceneId: scene.sceneSpecId }));
      if (!ranges.length) ranges = [{ start: 0, end: durationFrames }];
    } else {
      ranges = [{ start: 0, end: durationFrames }];
    }
    if ([plan.startSec, plan.endSec, plan.sourceStartSec, plan.volume].some(value => value != null && (!Number.isFinite(value) || value < 0))) {
      problem(plan, "Invalid audio timing or volume");
      continue;
    }
    ranges = ranges.map(range => ({ ...range,
      start: plan.startSec == null ? range.start : Math.max(range.start, secToFrames(plan.startSec, frameRate)),
      end: plan.endSec == null ? range.end : Math.min(range.end, secToFrames(plan.endSec, frameRate)),
    })).filter(range => range.end > range.start);
    if (!ranges.length) { problem(plan, "No valid timeline placement"); continue; }
    const sourceCursors = new Map<string, number>();
    for (let index = 0; index < ranges.length; index++) {
      const range = ranges[index];
      const explicitId = plan.voiceConversion ? plan.voiceConversion.outputAssetId : plan.assetId;
      const candidates = assets.filter(asset => asset.assetType === "audio" &&
        (!asset.sceneId || asset.sceneId === range.sceneId) && (!asset.shotId || asset.shotId === range.shotId));
      let asset = explicitId ? assets.find(item => item.id === explicitId && item.assetType === "audio") : undefined;
      if (!explicitId && !plan.voiceConversion) {
        const masterRef = plan.voiceMasterRef || plan.musicMasterRef;
        const matching = candidates.filter(item => masterRef ? item.masterRef === masterRef : audioAssetRole(item) === plan.kind);
        const scoped = matching.filter(item => item.shotId || item.sceneId);
        asset = scoped.length === 1 ? scoped[0] : matching.length === 1 ? matching[0] : undefined;
        // Old voice assets were untyped. Only an unambiguous single audio source is compatible.
        if (!asset && !masterRef && plan.kind === "narration" && candidates.length === 1 && !audioAssetRole(candidates[0]) && !candidates[0].role && !candidates[0].generationSettings?.kind) asset = candidates[0];
      }
      const track = ensureTrack(tracks, plan.kind, plan.lane ?? 0);
      // Dialogue is already audible in video. Represent it for ducking; never mix it twice.
      if (!asset && !explicitId && !plan.voiceConversion && plan.kind === "dialogue") {
        const embedded = videoClips.filter(clip => clip.mediaType === "video" && clip.sourceUrl && clip.timelineStartFrames < range.end && clip.timelineEndFrames > range.start &&
          assets.find(item => item.id === clip.assetId)?.generationSettings?.hasAudio !== false);
        if (embedded.length) {
          for (const clip of embedded) {
            const start = Math.max(range.start, clip.timelineStartFrames);
            const end = Math.min(range.end, clip.timelineEndFrames);
            track.clips.push({ ...clip, id: `audio_${plan.id}_${clip.id}`, trackId: track.id, mediaType: "audio", audioSource: "embedded", audioPlanId: plan.id, mandatory: plan.mandatory,
              sourceStartFrames: clip.sourceStartFrames + start - clip.timelineStartFrames,
              sourceEndFrames: clip.sourceStartFrames + end - clip.timelineStartFrames,
              timelineStartFrames: start, timelineEndFrames: end });
          }
          continue;
        }
      }
      const startSource = sourceCursors.get(asset?.id || "missing") ?? secToFrames(plan.sourceStartSec || 0, frameRate);
      const measuredSec = parseDurationToSec(asset?.duration);
      const measured = measuredSec != null && measuredSec > 0 ? secToFrames(measuredSec, frameRate) : undefined;
      const desired = range.end - range.start;
      const loop = !speech && plan.loop === true;
      const available = measured == null ? desired : Math.max(0, measured - startSource);
      const length = loop && available > 0 ? desired : Math.min(desired, available);
      if (!asset) problem(plan, plan.voiceConversion ? "Converted voice output is unavailable" : `Missing ${plan.kind} source for ${range.sceneId || "production"}`);
      if (length <= 0) { problem(plan, "Source trim is outside measured audio duration"); continue; }
      // Explicit speech slots must not silently cut off a known utterance.
      if (speech && measured != null && index === ranges.length - 1 && measured - startSource > desired && plan.endSec == null) problem(plan, "Measured speech exceeds its timeline slot; retime before mastering");
      const clip: EditorialClip = {
        id: `audio_${plan.id}_${index}`, trackId: track.id, audioPlanId: plan.id,
        assetId: asset?.id, sceneId: range.sceneId, shotId: range.shotId,
        sourceStartFrames: startSource, sourceEndFrames: startSource + Math.min(length, available),
        timelineStartFrames: range.start, timelineEndFrames: range.start + length,
        playbackRate: 1, transform: identityTransform(), opacity: 1,
        volume: plan.volume ?? 1, muted: false, volumeAutomation: [],
        label: plan.description, mediaType: "audio", sourceUrl: asset?.publicUrl, mimeType: asset?.mimeType,
        status: asset ? "accepted" : "planned", mandatory: plan.mandatory,
        audioSource: "external", loop, timingBasis: measured == null ? "planned" : "measured",
        voiceConversion: plan.voiceConversion,
        provenance: { productionId: spec.project.id, sceneId: range.sceneId, shotId: range.shotId, taskId: asset?.taskId, assetId: asset?.id, sourceAssetIds: asset ? [asset.id, ...(plan.voiceConversion ? [plan.voiceConversion.sourceAssetId] : [])] : [] },
      };
      track.clips.push(clip);
      if (asset) { assetIds.push(...clip.provenance.sourceAssetIds); sourceCursors.set(asset.id, startSource + length); }
      // A separately supplied dialogue track replaces the embedded voice in this range.
      if (asset && plan.kind === "dialogue") {
        for (const video of videoClips.filter(item => item.timelineStartFrames < clip.timelineEndFrames && item.timelineEndFrames > clip.timelineStartFrames)) {
          video.volumeAutomation.push({ atFrames: Math.max(video.timelineStartFrames, clip.timelineStartFrames), gainDb: -120 }, { atFrames: Math.min(video.timelineEndFrames, clip.timelineEndFrames), gainDb: 0 });
        }
      }
    }
  }
  return { unresolved, assetIds: [...new Set(assetIds)] };
}
