// ── Editing Execution Pipeline ──────────────────────────────────────────
// Orchestrates multi-step editing flows using the EditorToolRegistry.
// Singleton – obtain via EditingExecutionPipeline.getInstance().

import { EditorToolRegistry } from './editorToolRegistry';
import { TimelineEngine } from '../timeline/timelineEngine';
import { RenderService, RenderJob } from '../render/renderService';
import { ExportService, ExportPackage } from '../export/exportService';
import type { TimelineProject, TimelineClip } from '../../domain/editor/EditorTypes';

export class EditingExecutionPipeline {
  private static instance: EditingExecutionPipeline;

  private constructor() {}

  public static getInstance(): EditingExecutionPipeline {
    if (!EditingExecutionPipeline.instance) {
      EditingExecutionPipeline.instance = new EditingExecutionPipeline();
    }
    return EditingExecutionPipeline.instance;
  }

  /**
   * Run the complete automated editing pipeline.
   */
  public async executeEditing(
    projectId: string,
    creativeDirective: string,
    assets: { url: string; type: 'video' | 'image' | 'audio' }[],
    options: {
      platform: 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'twitter' | 'universal';
      editingStyle?: string;
      colorPalette?: string[];
      brandMemory?: any;
    }
  ): Promise<{ project: TimelineProject; renderJob: RenderJob; exportPackage: ExportPackage }> {
    const registry = EditorToolRegistry.getInstance();
    const engine = TimelineEngine.getInstance();
    const currentProject = engine.getProject();
    if (!currentProject) throw new Error('No timeline project loaded.');

    const style = options.editingStyle || 'cinematic';
    const colors = options.colorPalette || ['#FFFFFF'];
    const platform = options.platform;

    // 1. Setup Tracks
    const addTrackTool = registry.getTool('tool-editor-add-track');
    if (!addTrackTool) throw new Error('Add Track Tool not found');

    const videoTrack = await addTrackTool.execute({ type: 'video', label: 'Main Video' });
    const audioTrack = await addTrackTool.execute({ type: 'audio', label: 'Audio and Voiceover' });
    const textTrack = await addTrackTool.execute({ type: 'text', label: 'Captions and Subtitles' });

    // 2. Add Clips
    const addClipTool = registry.getTool('tool-editor-add-clip');
    if (!addClipTool) throw new Error('Add Clip Tool not found');

    let frameOffset = 0;
    const clipDuration = platform === 'tiktok' || platform === 'instagram' ? 90 : 150; // 3s or 5s
    const clips: TimelineClip[] = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const clip = await addClipTool.execute({
        trackId: videoTrack.id,
        type: asset.type === 'video' ? 'video' : 'image',
        sourceUrl: asset.url,
        durationFrames: clipDuration,
        startFrame: frameOffset,
        label: `Asset ${i + 1}`,
      });
      clips.push(clip);
      frameOffset += clipDuration;
    }

    // Fallback if no assets are provided
    if (assets.length === 0) {
      for (let i = 0; i < 4; i++) {
        const clip = await addClipTool.execute({
          trackId: videoTrack.id,
          type: 'video',
          sourceUrl: `/assets/scene_${i + 1}.mp4`,
          durationFrames: clipDuration,
          startFrame: frameOffset,
          label: `Placeholder Scene ${i + 1}`,
        });
        clips.push(clip);
        frameOffset += clipDuration;
      }
    }

    // 3. Apply Cinematic/Social Enhancements based on creative directive
    const isCinematic = creativeDirective.toLowerCase().includes('cinematic') || style === 'cinematic';
    const isSocial = creativeDirective.toLowerCase().includes('social') || style === 'social' || style === 'fastPaced';

    // Transitions
    const transitionTool = registry.getTool('tool-editor-transition');
    if (transitionTool && clips.length > 1) {
      const transType = isCinematic ? 'crossDissolve' : isSocial ? 'glitch' : 'crossDissolve';
      for (let i = 0; i < clips.length - 1; i++) {
        await transitionTool.execute({
          fromClipId: clips[i].id,
          toClipId: clips[i + 1].id,
          type: transType,
          durationFrames: 15,
        });
      }
    }

    // Camera Motion / Zooms
    const cameraMotionTool = registry.getTool('tool-editor-camera-motion');
    if (cameraMotionTool) {
      for (const clip of clips) {
        await cameraMotionTool.execute({
          clipId: clip.id,
          motionType: isCinematic ? 'dollyIn' : 'panRight',
          intensity: 40,
        });
      }
    }

    // Color Grade
    const colorGradeTool = registry.getTool('tool-editor-color-grade');
    if (colorGradeTool) {
      for (const clip of clips) {
        await colorGradeTool.execute({
          clipId: clip.id,
          contrast: isCinematic ? 1.15 : 1.05,
          saturation: isCinematic ? 0.85 : 1.1,
          brightness: 1.05,
          temperature: isCinematic ? -8 : 2, // Cool blue cinematic LUT vs warm social
          lut: isCinematic ? 'cinematic_teal_orange' : 'vibrant_social',
        });
      }
    }

    // 4. Music and Audio Setup
    const musicTool = registry.getTool('tool-editor-music');
    if (musicTool) {
      await musicTool.execute({
        sourceUrl: '/assets/music/brand_theme.mp3',
        durationFrames: frameOffset,
        volume: 0.35,
        startFrame: 0,
        label: 'Background Music',
      });
    }

    const voiceMixTool = registry.getTool('tool-editor-voice-mix');
    if (voiceMixTool) {
      await voiceMixTool.execute({
        voiceTrackId: textTrack.id,
        musicTrackId: audioTrack.id,
        voiceVolume: 1.0,
        musicVolume: 0.25,
        duckingEnabled: true,
        duckingThreshold: -15,
        duckingReduction: -10,
      });
    }

    // 5. Captions / Subtitles
    const captionTool = registry.getTool('tool-editor-caption');
    if (captionTool) {
      const sentenceCount = 5;
      const stepFrames = Math.floor(frameOffset / sentenceCount);
      for (let i = 0; i < sentenceCount; i++) {
        await captionTool.execute({
          text: `Creative Studio segment ${i + 1}: bringing your stories to life automatically.`,
          startFrame: i * stepFrames,
          endFrame: (i + 1) * stepFrames,
          style: {
            fontFamily: 'Geist Sans',
            fontSize: platform === 'tiktok' ? 56 : 48,
            color: colors[0] || '#FFFFFF',
            backgroundColor: '#000000',
            backgroundOpacity: 0.6,
          },
          animation: isCinematic ? 'fadeWord' : 'popIn',
        });
      }
    }

    // 6. Configure Export & Start Render
    const exportSettingsTool = registry.getTool('tool-editor-export');
    if (exportSettingsTool) {
      await exportSettingsTool.execute({
        format: 'mp4',
        codec: 'h264',
        resolution: platform === 'tiktok' || platform === 'instagram' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 },
        frameRate: 30,
        quality: 'high',
      });
    }

    const renderService = RenderService.getInstance();
    const renderJob = renderService.startRender(currentProject, currentProject.exportSettings);

    const exportService = ExportService.getInstance();
    const exportPackage = exportService.createExportPackage(renderJob, currentProject, {
      title: currentProject.name,
      description: `Automated ${style} production render for ${platform}`,
      tags: ['automated', 'production', platform],
      platform,
    });

    return {
      project: currentProject,
      renderJob,
      exportPackage,
    };
  }
}
