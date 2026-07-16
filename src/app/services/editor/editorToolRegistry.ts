// ── Editor Tool Registry ─────────────────────────────────────────────
// Wraps TimelineEngine operations as callable ToolDefinition entries.
// Singleton – obtain via EditorToolRegistry.getInstance().

import type { ToolDefinition } from '../toolRegistry';
import { Capability } from '../../domain/runtime/Capability';
import { TimelineEngine } from '../timeline/timelineEngine';
import type {
  TransitionType,
  CaptionStyle,
  AnimationEasing,
  ClipFilter,
} from '../../domain/editor/EditorTypes';

const TOOL_DEFAULTS = {
  capabilities: [Capability.VIDEO_GENERATION] as Capability[],
  health: 'healthy' as const,
  permissions: ['write'],
  version: '1.0.0',
};

export class EditorToolRegistry {
  private static instance: EditorToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  private constructor() {
    const engine = TimelineEngine.getInstance();

    // 1. Timeline – create or load projects
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-timeline',
      name: 'Timeline Project',
      execute: async (args: {
        action: 'create' | 'load';
        name?: string;
        resolution?: { width: number; height: number };
        frameRate?: number;
        project?: any;
      }) => {
        if (args.action === 'load' && args.project) {
          return engine.loadProject(args.project);
        }
        return engine.createProject(
          args.name ?? 'Untitled Project',
          args.resolution ?? { width: 1080, height: 1920 },
          args.frameRate ?? 30,
        );
      },
    });

    // Add Track Tool
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-add-track',
      name: 'Add Track',
      execute: async (args: { type: 'video' | 'audio' | 'text' | 'effects'; label: string }) => {
        return engine.addTrack(args.type, args.label);
      },
    });

    // Add Clip Tool
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-add-clip',
      name: 'Add Clip',
      execute: async (args: {
        trackId: string;
        type: 'video' | 'image' | 'audio' | 'text' | 'caption' | 'shape' | 'sticker';
        sourceUrl: string;
        durationFrames: number;
        startFrame?: number;
        label?: string;
      }) => {
        return engine.addClip(args.trackId, args);
      },
    });

    // 2. Trim
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-trim',
      name: 'Trim Clip',
      execute: async (args: { clipId: string; inPoint: number; outPoint: number }) => {
        return engine.trimClip(args.clipId, args.inPoint, args.outPoint);
      },
    });

    // 3. Split
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-split',
      name: 'Split Clip',
      execute: async (args: { clipId: string; framePosition: number }) => {
        const [first, second] = engine.splitClip(args.clipId, args.framePosition);
        return { first, second };
      },
    });

    // 4. Ripple Delete
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-ripple-delete',
      name: 'Ripple Delete',
      execute: async (args: { clipId: string }) => {
        engine.rippleDelete(args.clipId);
        return { status: 'deleted', clipId: args.clipId };
      },
    });

    // 5. Transition
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-transition',
      name: 'Add Transition',
      execute: async (args: {
        fromClipId: string;
        toClipId: string;
        type: TransitionType;
        durationFrames: number;
      }) => {
        return engine.addTransition(args.fromClipId, args.toClipId, args.type, args.durationFrames);
      },
    });

    // 6. Caption
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-caption',
      name: 'Add Caption',
      execute: async (args: {
        text: string;
        startFrame: number;
        endFrame: number;
        style?: Partial<CaptionStyle>;
        animation?: 'none' | 'typewriter' | 'fadeWord' | 'popIn' | 'slideUp' | 'karaoke';
      }) => {
        return engine.addCaption(args.text, args.startFrame, args.endFrame, args.style, args.animation);
      },
    });

    // 7. Subtitle – auto-generates captions from a text array with timing
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-subtitle',
      name: 'Auto Subtitles',
      execute: async (args: {
        segments: { text: string; startFrame: number; endFrame: number }[];
        style?: Partial<CaptionStyle>;
        animation?: 'none' | 'typewriter' | 'fadeWord' | 'popIn' | 'slideUp' | 'karaoke';
      }) => {
        const captions = args.segments.map((seg) =>
          engine.addCaption(seg.text, seg.startFrame, seg.endFrame, args.style, args.animation),
        );
        return { captions, count: captions.length };
      },
    });

    // 8. Beat Detection – simulates beat positions based on BPM
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-beat-detection',
      name: 'Beat Detection',
      execute: async (args: { bpm: number; durationSeconds: number; offsetSeconds?: number }) => {
        const beatInterval = 60 / args.bpm;
        const offset = args.offsetSeconds ?? 0;
        const beats: { time: number; frame: number; strength: number }[] = [];
        let t = offset;
        const project = engine.getProject();
        const fps = project?.frameRate ?? 30;
        let beatIndex = 0;
        while (t < args.durationSeconds) {
          beats.push({
            time: parseFloat(t.toFixed(4)),
            frame: Math.round(t * fps),
            // Every 4th beat is a downbeat (stronger)
            strength: beatIndex % 4 === 0 ? 1 : beatIndex % 2 === 0 ? 0.7 : 0.4,
          });
          t += beatInterval;
          beatIndex++;
        }
        return { bpm: args.bpm, beats, count: beats.length };
      },
    });

    // 9. Music – adds a background music track and clip
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-music',
      name: 'Add Music',
      execute: async (args: {
        sourceUrl: string;
        durationFrames: number;
        volume?: number;
        startFrame?: number;
        label?: string;
      }) => {
        const track = engine.addTrack('audio', args.label ?? 'Background Music');
        const clip = engine.addClip(track.id, {
          type: 'audio',
          sourceUrl: args.sourceUrl,
          durationFrames: args.durationFrames,
          startFrame: args.startFrame ?? 0,
          volume: args.volume ?? 0.6,
          label: args.label ?? 'Music',
        });
        return { track, clip };
      },
    });

    // 10. Noise Reduction
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-noise-reduction',
      name: 'Noise Reduction',
      execute: async (args: { clipId: string; strength?: number }) => {
        return engine.applyFilter(args.clipId, {
          type: 'noiseReduction',
          parameters: { strength: args.strength ?? 0.5, adaptive: true },
          enabled: true,
        });
      },
    });

    // 11. Auto Zoom – applies automated zoom keyframes over a clip's duration
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-auto-zoom',
      name: 'Auto Zoom',
      execute: async (args: {
        clipId: string;
        startScale: number;
        endScale: number;
        easing?: AnimationEasing;
      }) => {
        const project = engine.getProject();
        if (!project) throw new Error('No project loaded');
        // Find clip to determine duration
        let targetClip: any = null;
        for (const track of project.tracks) {
          const found = track.clips.find((c) => c.id === args.clipId);
          if (found) { targetClip = found; break; }
        }
        if (!targetClip) throw new Error(`Clip not found: ${args.clipId}`);

        const kfStart = engine.addKeyframe(
          args.clipId,
          targetClip.startFrame,
          'scale',
          args.startScale,
          args.easing ?? 'easeInOut',
        );
        const kfEnd = engine.addKeyframe(
          args.clipId,
          targetClip.endFrame,
          'scale',
          args.endScale,
          args.easing ?? 'easeInOut',
        );
        return { keyframes: [kfStart, kfEnd] };
      },
    });

    // 12. Camera Motion – applies camera motion keyframes (pan, dolly, etc.)
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-camera-motion',
      name: 'Camera Motion',
      execute: async (args: {
        clipId: string;
        motionType: 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'dollyIn' | 'dollyOut' | 'crane' | 'orbit';
        intensity?: number;
        easing?: AnimationEasing;
      }) => {
        const project = engine.getProject();
        if (!project) throw new Error('No project loaded');
        let targetClip: any = null;
        for (const track of project.tracks) {
          const found = track.clips.find((c) => c.id === args.clipId);
          if (found) { targetClip = found; break; }
        }
        if (!targetClip) throw new Error(`Clip not found: ${args.clipId}`);

        const intensity = args.intensity ?? 50;
        const ease = args.easing ?? 'easeInOut';
        const motionMap: Record<string, { prop: string; startVal: number; endVal: number }> = {
          panLeft:  { prop: 'positionX', startVal: 0, endVal: -intensity },
          panRight: { prop: 'positionX', startVal: 0, endVal: intensity },
          panUp:    { prop: 'positionY', startVal: 0, endVal: -intensity },
          panDown:  { prop: 'positionY', startVal: 0, endVal: intensity },
          dollyIn:  { prop: 'scale', startVal: 1, endVal: 1 + intensity / 100 },
          dollyOut: { prop: 'scale', startVal: 1 + intensity / 100, endVal: 1 },
          crane:    { prop: 'positionY', startVal: intensity, endVal: -intensity },
          orbit:    { prop: 'rotation', startVal: 0, endVal: intensity },
        };
        const motion = motionMap[args.motionType];
        const kfStart = engine.addKeyframe(args.clipId, targetClip.startFrame, motion.prop, motion.startVal, ease);
        const kfEnd = engine.addKeyframe(args.clipId, targetClip.endFrame, motion.prop, motion.endVal, ease);
        return { motionType: args.motionType, keyframes: [kfStart, kfEnd] };
      },
    });

    // 13. Crop – crops clip dimensions via scale and position
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-crop',
      name: 'Crop Clip',
      execute: async (args: {
        clipId: string;
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
      }) => {
        const project = engine.getProject();
        if (!project) throw new Error('No project loaded');
        let targetClip: any = null;
        for (const track of project.tracks) {
          const found = track.clips.find((c) => c.id === args.clipId);
          if (found) { targetClip = found; break; }
        }
        if (!targetClip) throw new Error(`Clip not found: ${args.clipId}`);
        targetClip.position = { x: args.x, y: args.y };
        targetClip.scale = { x: args.scaleX, y: args.scaleY };
        return targetClip;
      },
    });

    // 14. Scale – scales clip dimensions
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-scale',
      name: 'Scale Clip',
      execute: async (args: { clipId: string; scaleX: number; scaleY: number }) => {
        const project = engine.getProject();
        if (!project) throw new Error('No project loaded');
        let targetClip: any = null;
        for (const track of project.tracks) {
          const found = track.clips.find((c) => c.id === args.clipId);
          if (found) { targetClip = found; break; }
        }
        if (!targetClip) throw new Error(`Clip not found: ${args.clipId}`);
        targetClip.scale = { x: args.scaleX, y: args.scaleY };
        return targetClip;
      },
    });

    // 15. Color Grade
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-color-grade',
      name: 'Color Grade',
      execute: async (args: {
        clipId: string;
        brightness?: number;
        contrast?: number;
        saturation?: number;
        temperature?: number;
        tint?: number;
        highlights?: number;
        shadows?: number;
        lut?: string;
      }) => {
        return engine.applyFilter(args.clipId, {
          type: 'colorGrade',
          parameters: {
            brightness: args.brightness ?? 0,
            contrast: args.contrast ?? 0,
            saturation: args.saturation ?? 0,
            temperature: args.temperature ?? 0,
            tint: args.tint ?? 0,
            highlights: args.highlights ?? 0,
            shadows: args.shadows ?? 0,
            ...(args.lut ? { lut: args.lut } : {}),
          },
          enabled: true,
        });
      },
    });

    // 16. Animation – adds keyframe animations
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-animation',
      name: 'Keyframe Animation',
      execute: async (args: {
        clipId: string;
        keyframes: { frame: number; property: string; value: number; easing?: AnimationEasing }[];
      }) => {
        const results = args.keyframes.map((kf) =>
          engine.addKeyframe(args.clipId, kf.frame, kf.property, kf.value, kf.easing),
        );
        return { keyframes: results, count: results.length };
      },
    });

    // 17. Sticker – adds sticker/overlay clips
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-sticker',
      name: 'Add Sticker',
      execute: async (args: {
        sourceUrl: string;
        startFrame: number;
        durationFrames: number;
        position?: { x: number; y: number };
        scale?: { x: number; y: number };
        trackId?: string;
      }) => {
        let trackId = args.trackId;
        if (!trackId) {
          const track = engine.addTrack('effects', 'Stickers');
          trackId = track.id;
        }
        return engine.addClip(trackId, {
          type: 'sticker',
          sourceUrl: args.sourceUrl,
          durationFrames: args.durationFrames,
          startFrame: args.startFrame,
          position: args.position ?? { x: 0.5, y: 0.5 },
          scale: args.scale ?? { x: 0.3, y: 0.3 },
          label: 'Sticker',
        });
      },
    });

    // 18. Shape – adds shape overlay clips
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-shape',
      name: 'Add Shape',
      execute: async (args: {
        shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow';
        startFrame: number;
        durationFrames: number;
        color?: string;
        position?: { x: number; y: number };
        scale?: { x: number; y: number };
        trackId?: string;
      }) => {
        let trackId = args.trackId;
        if (!trackId) {
          const track = engine.addTrack('effects', 'Shapes');
          trackId = track.id;
        }
        return engine.addClip(trackId, {
          type: 'shape',
          sourceUrl: `shape://${args.shapeType}?color=${encodeURIComponent(args.color ?? '#FFFFFF')}`,
          durationFrames: args.durationFrames,
          startFrame: args.startFrame,
          position: args.position ?? { x: 0.5, y: 0.5 },
          scale: args.scale ?? { x: 0.2, y: 0.2 },
          label: `Shape: ${args.shapeType}`,
        });
      },
    });

    // 19. Voice Mix – configures audio ducking and voice mixing
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-voice-mix',
      name: 'Voice Mix',
      execute: async (args: {
        voiceTrackId: string;
        musicTrackId: string;
        voiceVolume?: number;
        musicVolume?: number;
        duckingEnabled?: boolean;
        duckingThreshold?: number;
        duckingReduction?: number;
      }) => {
        const voiceMix = engine.setAudioMix(args.voiceTrackId, {
          volume: args.voiceVolume ?? 1,
          noiseReduction: true,
          compressor: true,
        });
        const musicMix = engine.setAudioMix(args.musicTrackId, {
          volume: args.musicVolume ?? 0.3,
          ducking: {
            enabled: args.duckingEnabled ?? true,
            threshold: args.duckingThreshold ?? -20,
            reduction: args.duckingReduction ?? -12,
          },
        });
        return { voiceMix, musicMix };
      },
    });

    // 20. Export – configures export settings
    this.register({
      ...TOOL_DEFAULTS,
      id: 'tool-editor-export',
      name: 'Export Settings',
      execute: async (args: {
        format?: 'mp4' | 'webm' | 'mov' | 'gif';
        codec?: 'h264' | 'h265' | 'vp9' | 'prores';
        resolution?: { width: number; height: number };
        frameRate?: number;
        bitrate?: number;
        quality?: 'draft' | 'standard' | 'high' | 'master';
        audioCodec?: 'aac' | 'opus' | 'pcm';
        audioBitrate?: number;
      }) => {
        return engine.setExportSettings(args);
      },
    });
  }

  // ── Singleton access ───────────────────────────────────────────────

  public static getInstance(): EditorToolRegistry {
    if (!EditorToolRegistry.instance) {
      EditorToolRegistry.instance = new EditorToolRegistry();
    }
    return EditorToolRegistry.instance;
  }

  // ── Public API ─────────────────────────────────────────────────────

  public getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  // ── Internal ───────────────────────────────────────────────────────

  private register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
    console.log(`[EditorToolRegistry] Registered "${tool.name}" (${tool.id})`);
  }
}
