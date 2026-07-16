export type ClipType = 'video' | 'image' | 'audio' | 'text' | 'caption' | 'shape' | 'sticker';
export type TransitionType = 'cut' | 'crossDissolve' | 'fadeIn' | 'fadeOut' | 'wipeLeft' | 'wipeRight' | 'zoomIn' | 'zoomOut' | 'slideUp' | 'slideDown' | 'blur' | 'glitch';
export type CameraMotion = 'static' | 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'zoomIn' | 'zoomOut' | 'dollyIn' | 'dollyOut' | 'crane' | 'orbit' | 'shake' | 'track';
export type AnimationEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring' | 'bounce';

export interface TimelineClip {
  id: string;
  trackIndex: number;
  type: ClipType;
  sourceUrl: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  inPoint: number;
  outPoint: number;
  opacity: number;
  volume: number;
  position: { x: number; y: number };
  scale: { x: number; y: number };
  rotation: number;
  filters: ClipFilter[];
  keyframes: Keyframe[];
  locked: boolean;
  muted: boolean;
  label: string;
}

export interface ClipFilter {
  id: string;
  type: 'colorGrade' | 'blur' | 'sharpen' | 'filmGrain' | 'vignette' | 'lut' | 'chromaKey' | 'noiseReduction';
  parameters: Record<string, number | string | boolean>;
  enabled: boolean;
}

export interface Keyframe {
  id: string;
  frame: number;
  property: string;
  value: number;
  easing: AnimationEasing;
}

export interface TimelineTrack {
  id: string;
  index: number;
  type: 'video' | 'audio' | 'text' | 'effects';
  clips: TimelineClip[];
  locked: boolean;
  muted: boolean;
  solo: boolean;
  height: number;
  label: string;
}

export interface Transition {
  id: string;
  type: TransitionType;
  durationFrames: number;
  fromClipId: string;
  toClipId: string;
  parameters: Record<string, number | string>;
}

export interface Caption {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  style: CaptionStyle;
  animation: 'none' | 'typewriter' | 'fadeWord' | 'popIn' | 'slideUp' | 'karaoke';
  position: { x: number; y: number };
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  stroke: string;
  strokeWidth: number;
  textAlign: 'left' | 'center' | 'right';
  letterSpacing: number;
}

export interface AudioMix {
  trackId: string;
  volume: number;
  pan: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  compressor: boolean;
  noiseReduction: boolean;
  ducking: { enabled: boolean; threshold: number; reduction: number };
}

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mov' | 'gif';
  codec: 'h264' | 'h265' | 'vp9' | 'prores';
  resolution: { width: number; height: number };
  frameRate: number;
  bitrate: number;
  quality: 'draft' | 'standard' | 'high' | 'master';
  audioCodec: 'aac' | 'opus' | 'pcm';
  audioBitrate: number;
}

export interface TimelineProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  resolution: { width: number; height: number };
  frameRate: number;
  durationFrames: number;
  tracks: TimelineTrack[];
  transitions: Transition[];
  captions: Caption[];
  audioMixes: AudioMix[];
  exportSettings: ExportSettings;
  metadata: Record<string, any>;
}
