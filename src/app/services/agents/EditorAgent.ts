import { IDepartmentAgent, ExecutionContext } from '../../domain/runtime/IDepartmentAgent';
import { AgentDefinition } from '../../domain/runtime/AgentDefinition';
import { ExecutionTask } from '../../domain/runtime/ExecutionTask';
import { ProviderSelection } from '../modelRouter';
import { AgentResult } from '../../domain/runtime/AgentResult';
import { AgentRegistry } from '../agentRegistry';
import { EditorToolRegistry } from '../editor/editorToolRegistry';
import { EditingExecutionPipeline } from '../editor/EditingExecutionPipeline';
import { WorkspaceIntelligence } from '../workspace/workspaceIntelligence';
import { MediaIntelligence } from '../media/mediaIntelligence';

export class EditorAgent implements IDepartmentAgent {
  public definition: AgentDefinition;

  constructor() {
    this.definition = AgentRegistry.getInstance().getAgent('agent-editor') || {
      id: 'agent-editor',
      name: 'EditorAgent',
      department: 'editor',
      capabilities: [],
      status: 'healthy',
      version: '1.0.0',
      performanceMetrics: { avgLatencyMs: 12000, avgCostUsd: 0.08, successRate: 0.92, qualityScore: 91 }
    };
  }

  public async initialize(): Promise<void> {
    console.log('[Editor Agent] Initializing editing pipeline and timeline engine...');
  }

  public canExecute(task: ExecutionTask): boolean {
    return task.department === 'editor';
  }

  public async prepare(task: ExecutionTask): Promise<void> {
    console.log(`[Editor Agent] Preparing editing workspace for task: ${task.id}`);
  }

  public async execute(
    task: ExecutionTask,
    context: ExecutionContext,
    selection: ProviderSelection,
    onChunk?: (text: string) => void
  ): Promise<AgentResult> {
    const startTime = Date.now();
    console.log('[Editor Agent] Starting automated editing pipeline via tool registry...');

    // Extract brand preferences from context
    const colorPalette = context.brandMemory.visualRules.colorPalette || [];
    const editingStyle = context.brandMemory.editingStyle || 'cinematic';

    if (onChunk) onChunk('[Editor] Launching project timeline tool...');

    // 1. Create timeline project via EditorToolRegistry tool
    const registry = EditorToolRegistry.getInstance();
    const timelineTool = registry.getTool('tool-editor-timeline');
    if (!timelineTool) throw new Error('Timeline Tool not registered.');

    const platform = task.objective.toLowerCase().includes('tiktok') ? 'tiktok' :
                     task.objective.toLowerCase().includes('youtube') ? 'youtube' :
                     task.objective.toLowerCase().includes('instagram') ? 'instagram' : 'youtube';

    const resolution = platform === 'tiktok' || platform === 'instagram'
      ? { width: 1080, height: 1920 }
      : { width: 1920, height: 1080 };

    const project = await timelineTool.execute({
      action: 'create',
      name: `Production-${task.id}`,
      resolution,
      frameRate: 30,
    });

    if (onChunk) onChunk(`[Editor] Created timeline project via tool: ${project.name}`);

    // 2. Parse assets from Production output in shared context
    const productionOutput = context.sharedDataSnapshot?.production || '';
    const imageUrls = (productionOutput.match(/https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp)/gi) || []);
    const videoUrls = (productionOutput.match(/https?:\/\/[^\s)]+\.(?:mp4|webm|mov)/gi) || []);
    
    const parsedAssets = [
      ...videoUrls.map((url: string) => ({ url, type: 'video' as const })),
      ...imageUrls.map((url: string) => ({ url, type: 'image' as const }))
    ];

    if (onChunk) onChunk(`[Editor] Loaded ${parsedAssets.length} assets from ProductionAgent`);

    // 3. Check Media Intelligence decision
    const assetUrls = parsedAssets.map(a => a.url);
    const mediaIntel = MediaIntelligence.getInstance().analyzeMedia(assetUrls);
    
    if (onChunk) onChunk(`[Editor] Media Intelligence overall quality score: ${mediaIntel.evaluation.overallScore}`);
    
    let finalProject = project;
    let finalRenderJob: any = { id: 'render-skipped', status: 'completed' as const, progress: 100, outputUrl: assetUrls[0] || '/assets/default_render.mp4', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), error: null };
    let finalExportPkg: any = { id: 'export-skipped', renderJobId: 'render-skipped', videoUrl: assetUrls[0] || '/assets/default_render.mp4', thumbnailUrl: '/thumbnails/default.jpg', title: project.name, description: 'Skipped editing per Media Intelligence decision', tags: [] as string[], platform, resolution: { width: 1920, height: 1080 }, durationSeconds: 30, fileSize: 100000, createdAt: new Date().toISOString(), status: 'ready' as const };

    if (!mediaIntel.decision.shouldEdit) {
      if (onChunk) onChunk('[Editor] Media Intelligence approved generated media. Skipping editing.');
    } else {
      if (onChunk) onChunk(`[Editor] Editing required: ${mediaIntel.decision.reasons.join(', ')}. Applying required edits...`);
      const pipeline = EditingExecutionPipeline.getInstance();
      const editRes = await pipeline.executeEditing(project.id, task.objective, parsedAssets, {
        platform,
        editingStyle,
        colorPalette,
        brandMemory: context.brandMemory,
      });
      finalProject = editRes.project;
      finalRenderJob = editRes.renderJob;
      finalExportPkg = editRes.exportPackage;
    }

    if (onChunk) onChunk(`[Editor] Timeline render job status: ${finalRenderJob.status}`);

    // 4. Workspace Integration - Automatically store production artifacts in Workspace Intelligence
    const artifacts = {
      storyboard: context.sharedDataSnapshot?.storyboard || null,
      timeline: finalProject,
      assets: parsedAssets.map(a => a.url),
      voice: `/assets/audio/voice_${task.id}.mp3`,
      music: '/assets/music/brand_theme.mp3',
      captions: finalProject.captions,
      export: finalExportPkg,
      thumbnail: finalExportPkg.thumbnailUrl,
      metadata: {
        title: finalProject.name,
        description: `Automated render for ${platform}`,
        tags: ['automated', platform]
      },
      publishingPackage: {
        videoUrl: finalExportPkg.videoUrl,
        platform
      }
    };

    WorkspaceIntelligence.getInstance().addProductionArtifacts(task.id, artifacts);
    if (onChunk) onChunk('[Editor] Saved production package, timeline, and export bundle to Workspace Intelligence.');

    const totalLatency = Date.now() - startTime;

    return {
      id: `res-${Date.now()}`,
      taskId: task.id,
      output: `Editing Pipeline Completed.\n- Timeline: ${finalProject.name}\n- Export: ${finalExportPkg.videoUrl}\n- Render status: ${finalRenderJob.status}`,
      structuredData: {
        projectId: finalProject.id,
        exportPackageId: finalExportPkg.id,
        videoUrl: finalExportPkg.videoUrl,
        thumbnailUrl: finalExportPkg.thumbnailUrl,
        platform,
        resolution,
        durationSeconds: finalProject.durationFrames / 30,
        clipCount: finalProject.tracks[0]?.clips.length || 0,
        captionCount: finalProject.captions.length,
      },
      rawResponse: { renderJob: finalRenderJob, exportPkg: finalExportPkg },
      metrics: {
        latencyMs: totalLatency,
        costUsd: 0.02,
        inputTokens: 0,
        outputTokens: 0
      },
      status: 'success'
    };
  }

  public validate(result: AgentResult): boolean {
    return result.status === 'success' && !!result.structuredData?.videoUrl;
  }

  public async cleanup(): Promise<void> {
    console.log('[Editor Agent] Cleaning up timeline resources...');
  }
}
