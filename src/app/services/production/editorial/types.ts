/**
 * Phase 6 — Canonical editorial timeline types (provider-neutral).
 * References assets; never embeds media blobs.
 */

export type EditorialStatus =
  | "draft"
  | "assembling"
  | "incomplete"
  | "validated"
  | "ready_for_master"
  | "mastering"
  | "mastered"
  | "failed"
  | "cancelled";

export type EditorialClipStatus =
  | "planned"
  | "provisional"
  | "accepted"
  | "missing"
  | "excluded"
  | "manual_exception";

export type TrackKind =
  | "video"
  | "dialogue"
  | "narration"
  | "ambience"
  | "music"
  | "sfx"
  | "text"
  | "vfx";

export type TransitionType = "cut" | "dissolve" | "fade_in" | "fade_out" | string;

export type CaptionRenderMode = "burn_in" | "sidecar" | "both" | "none";

/** Integer frames at a fixed timebase — avoids float drift */
export interface RationalTime {
  frames: number;
  frameRate: number;
}

export interface EditorialTransform {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  rotationDeg: number;
}

export interface CropReframe {
  strategy: "center" | "top" | "bottom" | "left" | "right" | "subject_aware" | "custom";
  /** Normalized crop window 0–1 relative to source frame */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Reserved for future subject-aware reframe */
  subjectAwareHint?: string;
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
}

export interface VolumeKeyframe {
  atFrames: number;
  gainDb: number;
}

export interface EditorialTransition {
  id: string;
  type: TransitionType;
  durationFrames: number;
  fromClipId?: string;
  toClipId?: string;
  atFrames: number;
}

export interface EditorialProvenance {
  productionId: string;
  sceneId?: string;
  shotId?: string;
  taskId?: string;
  assetId?: string;
  assetVersion?: string;
  generationAttempt?: number;
  qcStatus?: string;
  sourceAssetIds: string[];
}

export interface EditorialClip {
  id: string;
  trackId: string;
  assetId?: string;
  shotId?: string;
  sceneId?: string;
  /** Source media trim — frames in source timebase */
  sourceStartFrames: number;
  sourceEndFrames: number;
  /** Timeline placement */
  timelineStartFrames: number;
  timelineEndFrames: number;
  playbackRate: number;
  crop?: CropReframe;
  transform: EditorialTransform;
  opacity: number;
  volume: number;
  muted: boolean;
  volumeAutomation: VolumeKeyframe[];
  transitionIn?: TransitionType;
  transitionOut?: TransitionType;
  label: string;
  mediaType: "video" | "audio" | "image" | "text";
  sourceUrl?: string;
  mimeType?: string;
  status: EditorialClipStatus;
  provenance: EditorialProvenance;
}

export interface EditorialTrack {
  id: string;
  kind: TrackKind;
  /** Lane index within kind, e.g. V1→0, V2→1, D1→0 */
  lane: number;
  name: string;
  clips: EditorialClip[];
  muted?: boolean;
  solo?: boolean;
}

export interface EditorialScene {
  id: string;
  sceneSpecId: string;
  order: number;
  startFrames: number;
  durationFrames: number;
  shotIds: string[];
  clipIds: string[];
  transitionIn?: TransitionType;
  transitionOut?: TransitionType;
  continuitySummary?: string;
  audioNotes?: string;
  effects?: string[];
}

export interface CaptionCue {
  id: string;
  text: string;
  startFrames: number;
  endFrames: number;
  language: string;
  speaker?: string;
  style?: Record<string, unknown>;
  renderMode: CaptionRenderMode;
  provenance?: { sceneId?: string; shotId?: string; source: string };
}

export interface AudioMixInstruction {
  id: string;
  kind: "duck" | "fade_in" | "fade_out" | "gain" | "mute";
  targetTrackId: string;
  /** When ducking, the trigger track (e.g. dialogue) */
  triggerTrackId?: string;
  startFrames: number;
  endFrames: number;
  gainDb: number;
  /** Duck amount applied to target when trigger is active */
  duckDb?: number;
  priority: number;
}

export interface ColorMasteringConfig {
  lutRef?: string;
  exposure?: number;
  contrast?: number;
  saturation?: number;
  notes?: string;
}

export interface DeliveryVariant {
  id: string;
  name: string;
  resolution: { width: number; height: number };
  aspectRatio: string;
  frameRate: number;
  bitrateKbps?: number;
  qualityTarget?: "draft" | "social" | "broadcast" | "cinema";
  codec: string;
  container: string;
  maxDurationSec?: number;
  captionPolicy: CaptionRenderMode;
  audioTarget: {
    sampleRateHz: number;
    channels: number;
    codec: string;
  };
  safeAreas?: { top: number; right: number; bottom: number; left: number };
  reframe?: CropReframe;
}

export interface UnresolvedDependency {
  kind: "missing_asset" | "failed_asset" | "qc_blocked" | "missing_audio" | "missing_caption";
  sceneId?: string;
  shotId?: string;
  taskId?: string;
  message: string;
}

export interface EditorialTimeline {
  id: string;
  productionId: string;
  version: number;
  frameRate: number;
  timebase: "frames";
  durationFrames: number;
  resolution: { width: number; height: number };
  aspectRatio: string;
  scenes: EditorialScene[];
  tracks: EditorialTrack[];
  transitions: EditorialTransition[];
  captions: CaptionCue[];
  audioMix: AudioMixInstruction[];
  colorMastering?: ColorMasteringConfig;
  variants: DeliveryVariant[];
  status: EditorialStatus;
  unresolvedDependencies: UnresolvedDependency[];
  provenance: {
    productionId: string;
    qcVerdict?: string;
    assembledFromAssetIds: string[];
    sourceSpecVersion?: number;
  };
  createdAt: string;
  updatedAt: string;
  userMessage: string;
  /** Developer diagnostics — never secrets */
  diagnostics?: Record<string, unknown>;
}

/** Legacy track kinds kept for compatibility with earlier timelineService exports */
export type TimelineTrackKind =
  | "video_primary"
  | "video_broll"
  | "video_overlay"
  | "audio_dialogue"
  | "audio_narration"
  | "audio_ambience"
  | "audio_music"
  | "audio_sfx"
  | "gfx_captions"
  | "gfx_titles"
  | "gfx_lower_thirds"
  | "gfx_vfx";
