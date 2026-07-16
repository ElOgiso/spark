// ── Timeline Engine ──────────────────────────────────────────────────
// Core timeline manipulation engine for the SPARK Creative Studio.
// Singleton – obtain via TimelineEngine.getInstance().

import type {
  TimelineProject,
  TimelineTrack,
  TimelineClip,
  ClipFilter,
  Keyframe,
  Transition,
  Caption,
  CaptionStyle,
  AudioMix,
  ExportSettings,
} from '../../domain/editor/EditorTypes';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: 'Inter',
  fontSize: 48,
  fontWeight: 700,
  color: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  stroke: '#000000',
  strokeWidth: 2,
  textAlign: 'center',
  letterSpacing: 0,
};

export class TimelineEngine {
  private static instance: TimelineEngine;
  private project: TimelineProject | null = null;

  private constructor() {}

  public static getInstance(): TimelineEngine {
    if (!TimelineEngine.instance) {
      TimelineEngine.instance = new TimelineEngine();
    }
    return TimelineEngine.instance;
  }

  // ── Project lifecycle ──────────────────────────────────────────────

  public createProject(
    name: string,
    resolution: { width: number; height: number },
    frameRate: number,
  ): TimelineProject {
    const now = new Date().toISOString();
    this.project = {
      id: generateId('proj'),
      name,
      resolution,
      frameRate,
      durationFrames: 0,
      tracks: [],
      transitions: [],
      captions: [],
      audioMixes: [],
      exportSettings: {
        format: 'mp4',
        codec: 'h264',
        resolution: { width: 1080, height: 1920 },
        frameRate: 30,
        bitrate: 8_000_000,
        quality: 'standard',
        audioCodec: 'aac',
        audioBitrate: 192_000,
      },
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    console.log(`[TimelineEngine] Created project "${name}" (${this.project.id})`);
    return this.project;
  }

  public loadProject(project: TimelineProject): TimelineProject {
    this.project = { ...project, updatedAt: new Date().toISOString() };
    console.log(`[TimelineEngine] Loaded project "${project.name}" (${project.id})`);
    return this.project;
  }

  public getProject(): TimelineProject | null {
    return this.project;
  }

  // ── Track operations ───────────────────────────────────────────────

  public addTrack(
    type: TimelineTrack['type'],
    label: string,
  ): TimelineTrack {
    this.ensureProject();
    const track: TimelineTrack = {
      id: generateId('trk'),
      index: this.project!.tracks.length,
      type,
      label,
      clips: [],
      locked: false,
      muted: false,
      solo: false,
      height: 64,
    };
    this.project!.tracks.push(track);
    this.touch();
    console.log(`[TimelineEngine] Added ${type} track "${label}" (${track.id})`);
    return track;
  }

  public removeTrack(trackId: string): void {
    this.ensureProject();
    const idx = this.project!.tracks.findIndex((t) => t.id === trackId);
    if (idx === -1) throw new Error(`Track not found: ${trackId}`);
    this.project!.tracks.splice(idx, 1);
    // Re-index remaining tracks
    this.project!.tracks.forEach((t, i) => (t.index = i));
    // Remove transitions referencing clips on this track
    const removedClipIds = new Set(this.project!.tracks[idx]?.clips.map((c) => c.id) ?? []);
    this.project!.transitions = this.project!.transitions.filter(
      (tr) => !removedClipIds.has(tr.fromClipId) && !removedClipIds.has(tr.toClipId),
    );
    this.touch();
    console.log(`[TimelineEngine] Removed track ${trackId}`);
  }

  // ── Clip operations ────────────────────────────────────────────────

  public addClip(
    trackId: string,
    clipData: Partial<TimelineClip> & { type: TimelineClip['type']; sourceUrl: string; durationFrames: number },
  ): TimelineClip {
    this.ensureProject();
    const track = this.findTrack(trackId);
    const clip: TimelineClip = {
      id: generateId('clip'),
      trackIndex: track.index,
      type: clipData.type,
      sourceUrl: clipData.sourceUrl,
      startFrame: clipData.startFrame ?? 0,
      endFrame: (clipData.startFrame ?? 0) + clipData.durationFrames,
      durationFrames: clipData.durationFrames,
      inPoint: clipData.inPoint ?? 0,
      outPoint: clipData.outPoint ?? clipData.durationFrames,
      opacity: clipData.opacity ?? 1,
      volume: clipData.volume ?? 1,
      position: clipData.position ?? { x: 0, y: 0 },
      scale: clipData.scale ?? { x: 1, y: 1 },
      rotation: clipData.rotation ?? 0,
      filters: clipData.filters ?? [],
      keyframes: clipData.keyframes ?? [],
      locked: clipData.locked ?? false,
      muted: clipData.muted ?? false,
      label: clipData.label ?? '',
    };
    track.clips.push(clip);
    this.touch();
    console.log(`[TimelineEngine] Added ${clip.type} clip (${clip.id}) to track ${trackId}`);
    return clip;
  }

  public removeClip(clipId: string): void {
    this.ensureProject();
    for (const track of this.project!.tracks) {
      const idx = track.clips.findIndex((c) => c.id === clipId);
      if (idx !== -1) {
        track.clips.splice(idx, 1);
        // Clean up transitions referencing this clip
        this.project!.transitions = this.project!.transitions.filter(
          (tr) => tr.fromClipId !== clipId && tr.toClipId !== clipId,
        );
        this.touch();
        console.log(`[TimelineEngine] Removed clip ${clipId}`);
        return;
      }
    }
    throw new Error(`Clip not found: ${clipId}`);
  }

  public trimClip(clipId: string, inPoint: number, outPoint: number): TimelineClip {
    this.ensureProject();
    const clip = this.findClip(clipId);
    clip.inPoint = inPoint;
    clip.outPoint = outPoint;
    clip.durationFrames = outPoint - inPoint;
    clip.endFrame = clip.startFrame + clip.durationFrames;
    this.touch();
    console.log(`[TimelineEngine] Trimmed clip ${clipId} in=${inPoint} out=${outPoint}`);
    return clip;
  }

  public splitClip(clipId: string, framePosition: number): [TimelineClip, TimelineClip] {
    this.ensureProject();
    const clip = this.findClip(clipId);
    const track = this.findTrackByClip(clipId);

    if (framePosition <= clip.startFrame || framePosition >= clip.endFrame) {
      throw new Error(
        `Split position ${framePosition} is outside clip range [${clip.startFrame}, ${clip.endFrame}]`,
      );
    }

    const relSplit = framePosition - clip.startFrame;

    // First half – mutate existing clip
    const firstDuration = relSplit;
    clip.endFrame = framePosition;
    clip.durationFrames = firstDuration;
    clip.outPoint = clip.inPoint + firstDuration;

    // Second half – new clip
    const secondDuration = clip.durationFrames; // remaining
    const second: TimelineClip = {
      ...structuredClone(clip),
      id: generateId('clip'),
      startFrame: framePosition,
      endFrame: framePosition + (clip.outPoint - clip.inPoint) + (clip.endFrame - clip.startFrame === 0 ? 0 : 0),
      durationFrames: 0, // will be recalculated
      inPoint: clip.outPoint,
      outPoint: clip.outPoint,
    };
    // Recalculate second clip properly
    const originalEnd = clip.startFrame + firstDuration + (second.outPoint - second.inPoint || 0);
    second.startFrame = framePosition;
    second.inPoint = clip.outPoint;
    second.outPoint = clip.inPoint + firstDuration + (clip.endFrame - clip.startFrame);
    // Simpler approach: treat the original clip's total source range
    const origInPoint = clip.inPoint;
    const origOutPoint = second.outPoint;

    // Reset second half cleanly
    second.startFrame = framePosition;
    second.inPoint = origInPoint + firstDuration;
    second.durationFrames = (origOutPoint > second.inPoint) ? origOutPoint - second.inPoint : clip.durationFrames;
    second.endFrame = second.startFrame + second.durationFrames;
    second.outPoint = second.inPoint + second.durationFrames;

    // Fix first half outPoint to be right before second
    clip.outPoint = second.inPoint;

    track.clips.push(second);
    // Sort clips by startFrame for consistency
    track.clips.sort((a, b) => a.startFrame - b.startFrame);
    this.touch();
    console.log(`[TimelineEngine] Split clip ${clipId} at frame ${framePosition} → [${clip.id}, ${second.id}]`);
    return [clip, second];
  }

  public moveClip(clipId: string, targetTrackId: string, startFrame: number): TimelineClip {
    this.ensureProject();
    const clip = this.findClip(clipId);
    const sourceTrack = this.findTrackByClip(clipId);
    const targetTrack = this.findTrack(targetTrackId);

    // Remove from source
    sourceTrack.clips = sourceTrack.clips.filter((c) => c.id !== clipId);

    // Update position
    clip.startFrame = startFrame;
    clip.endFrame = startFrame + clip.durationFrames;
    clip.trackIndex = targetTrack.index;

    // Add to target
    targetTrack.clips.push(clip);
    targetTrack.clips.sort((a, b) => a.startFrame - b.startFrame);
    this.touch();
    console.log(`[TimelineEngine] Moved clip ${clipId} → track ${targetTrackId} @ frame ${startFrame}`);
    return clip;
  }

  public rippleDelete(clipId: string): void {
    this.ensureProject();
    const track = this.findTrackByClip(clipId);
    const clipIdx = track.clips.findIndex((c) => c.id === clipId);
    const clip = track.clips[clipIdx];
    const gap = clip.durationFrames;

    // Remove the clip
    track.clips.splice(clipIdx, 1);

    // Shift all subsequent clips backwards
    for (const c of track.clips) {
      if (c.startFrame >= clip.startFrame) {
        c.startFrame -= gap;
        c.endFrame -= gap;
      }
    }

    // Clean transitions
    this.project!.transitions = this.project!.transitions.filter(
      (tr) => tr.fromClipId !== clipId && tr.toClipId !== clipId,
    );
    this.touch();
    console.log(`[TimelineEngine] Ripple-deleted clip ${clipId}, shifted by ${gap} frames`);
  }

  // ── Transitions ────────────────────────────────────────────────────

  public addTransition(
    fromClipId: string,
    toClipId: string,
    type: Transition['type'],
    durationFrames: number,
  ): Transition {
    this.ensureProject();
    // Validate clips exist
    this.findClip(fromClipId);
    this.findClip(toClipId);
    const transition: Transition = {
      id: generateId('trans'),
      type,
      fromClipId,
      toClipId,
      durationFrames,
      parameters: {},
    };
    this.project!.transitions.push(transition);
    this.touch();
    console.log(`[TimelineEngine] Added ${type} transition (${transition.id}) between ${fromClipId} → ${toClipId}`);
    return transition;
  }

  public removeTransition(transitionId: string): void {
    this.ensureProject();
    const idx = this.project!.transitions.findIndex((t) => t.id === transitionId);
    if (idx === -1) throw new Error(`Transition not found: ${transitionId}`);
    this.project!.transitions.splice(idx, 1);
    this.touch();
    console.log(`[TimelineEngine] Removed transition ${transitionId}`);
  }

  // ── Captions ───────────────────────────────────────────────────────

  public addCaption(
    text: string,
    startFrame: number,
    endFrame: number,
    style?: Partial<CaptionStyle>,
    animation?: Caption['animation'],
  ): Caption {
    this.ensureProject();
    const caption: Caption = {
      id: generateId('cap'),
      text,
      startFrame,
      endFrame,
      style: { ...DEFAULT_CAPTION_STYLE, ...(style ?? {}) },
      animation: animation ?? 'none',
      position: { x: 0.5, y: 0.85 },
    };
    this.project!.captions.push(caption);
    this.touch();
    console.log(`[TimelineEngine] Added caption (${caption.id}) "${text.slice(0, 30)}…"`);
    return caption;
  }

  public removeCaption(captionId: string): void {
    this.ensureProject();
    const idx = this.project!.captions.findIndex((c) => c.id === captionId);
    if (idx === -1) throw new Error(`Caption not found: ${captionId}`);
    this.project!.captions.splice(idx, 1);
    this.touch();
    console.log(`[TimelineEngine] Removed caption ${captionId}`);
  }

  // ── Keyframes ──────────────────────────────────────────────────────

  public addKeyframe(
    clipId: string,
    frame: number,
    property: string,
    value: number,
    easing?: Keyframe['easing'],
  ): Keyframe {
    this.ensureProject();
    const clip = this.findClip(clipId);
    const kf: Keyframe = {
      id: generateId('kf'),
      frame,
      property,
      value,
      easing: easing ?? 'linear',
    };
    clip.keyframes.push(kf);
    clip.keyframes.sort((a, b) => a.frame - b.frame);
    this.touch();
    console.log(`[TimelineEngine] Added keyframe (${kf.id}) ${property}=${value} @ frame ${frame}`);
    return kf;
  }

  // ── Filters ────────────────────────────────────────────────────────

  public applyFilter(clipId: string, filter: Omit<ClipFilter, 'id'>): ClipFilter {
    this.ensureProject();
    const clip = this.findClip(clipId);
    const f: ClipFilter = { id: generateId('flt'), ...filter };
    clip.filters.push(f);
    this.touch();
    console.log(`[TimelineEngine] Applied filter ${f.type} (${f.id}) to clip ${clipId}`);
    return f;
  }

  public removeFilter(clipId: string, filterId: string): void {
    this.ensureProject();
    const clip = this.findClip(clipId);
    const idx = clip.filters.findIndex((f) => f.id === filterId);
    if (idx === -1) throw new Error(`Filter not found: ${filterId}`);
    clip.filters.splice(idx, 1);
    this.touch();
    console.log(`[TimelineEngine] Removed filter ${filterId} from clip ${clipId}`);
  }

  // ── Audio mixing ───────────────────────────────────────────────────

  public setAudioMix(trackId: string, mix: Partial<AudioMix>): AudioMix {
    this.ensureProject();
    this.findTrack(trackId); // validate track exists
    let existing = this.project!.audioMixes.find((m) => m.trackId === trackId);
    if (existing) {
      Object.assign(existing, mix);
    } else {
      existing = {
        trackId,
        volume: 1,
        pan: 0,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        compressor: false,
        noiseReduction: false,
        ducking: { enabled: false, threshold: -20, reduction: -12 },
        ...mix,
      };
      this.project!.audioMixes.push(existing);
    }
    this.touch();
    console.log(`[TimelineEngine] Updated audio mix for track ${trackId}`);
    return existing;
  }

  // ── Export settings ────────────────────────────────────────────────

  public setExportSettings(settings: Partial<ExportSettings>): ExportSettings {
    this.ensureProject();
    this.project!.exportSettings = { ...this.project!.exportSettings, ...settings };
    this.touch();
    console.log(`[TimelineEngine] Updated export settings`);
    return this.project!.exportSettings;
  }

  // ── Duration helpers ───────────────────────────────────────────────

  public getProjectDuration(): number {
    if (!this.project) return 0;
    let maxEnd = 0;
    for (const track of this.project.tracks) {
      for (const clip of track.clips) {
        if (clip.endFrame > maxEnd) maxEnd = clip.endFrame;
      }
    }
    for (const caption of this.project.captions) {
      if (caption.endFrame > maxEnd) maxEnd = caption.endFrame;
    }
    return maxEnd;
  }

  public getProjectDurationSeconds(): number {
    if (!this.project || this.project.frameRate <= 0) return 0;
    return this.getProjectDuration() / this.project.frameRate;
  }

  // ── Internal helpers ───────────────────────────────────────────────

  private ensureProject(): void {
    if (!this.project) {
      throw new Error('[TimelineEngine] No project loaded. Call createProject() or loadProject() first.');
    }
  }

  private touch(): void {
    if (this.project) {
      this.project.updatedAt = new Date().toISOString();
      this.project.durationFrames = this.getProjectDuration();
    }
  }

  private findTrack(trackId: string): TimelineTrack {
    const track = this.project!.tracks.find((t) => t.id === trackId);
    if (!track) throw new Error(`Track not found: ${trackId}`);
    return track;
  }

  private findClip(clipId: string): TimelineClip {
    for (const track of this.project!.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return clip;
    }
    throw new Error(`Clip not found: ${clipId}`);
  }

  private findTrackByClip(clipId: string): TimelineTrack {
    for (const track of this.project!.tracks) {
      if (track.clips.some((c) => c.id === clipId)) return track;
    }
    throw new Error(`No track contains clip: ${clipId}`);
  }
}
