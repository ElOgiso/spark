import { IDepartmentAgent, ExecutionContext } from "../../domain/runtime/IDepartmentAgent";
import { AgentDefinition } from "../../domain/runtime/AgentDefinition";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection, ModelRouter } from "../modelRouter";
import { AgentResult } from "../../domain/runtime/AgentResult";
import { AgentRegistry } from "../agentRegistry";
import { MediaAdapterFactory } from "../mediaProviderAdapters";
import { PerformanceHistory } from "../performanceHistory";
import { StoryboardEngine } from "../storyboard/storyboardEngine";

export class ProductionAgent implements IDepartmentAgent {
  public definition: AgentDefinition;

  constructor() {
    this.definition = AgentRegistry.getInstance().getAgent("agent-production") || {
      id: "agent-production",
      name: "ProductionAgent",
      department: "production",
      capabilities: [],
      status: "healthy",
      version: "1.0.4",
      performanceMetrics: { avgLatencyMs: 8500, avgCostUsd: 0.05, successRate: 0.94, qualityScore: 89 }
    };
  }

  public async initialize(): Promise<void> {
    console.log(`[Production Agent] Initializing asset pipelines...`);
  }

  public canExecute(task: ExecutionTask): boolean {
    return task.department === "production";
  }

  public async prepare(task: ExecutionTask): Promise<void> {
    console.log(`[Production Agent] Allocating render limits for task: ${task.id}`);
  }

  public async execute(
    task: ExecutionTask,
    context: ExecutionContext,
    selection: ProviderSelection,
    onChunk?: (text: string) => void
  ): Promise<AgentResult> {
    console.log(`[Production Agent] Starting storyboard-driven production pipeline...`);
    const startTime = Date.now();

    const platform = task.objective.toLowerCase().includes('tiktok') ? 'tiktok' :
                     task.objective.toLowerCase().includes('youtube') ? 'youtube' :
                     task.objective.toLowerCase().includes('instagram') ? 'instagram' : 'youtube';

    // 1. Generate Storyboard as the execution plan
    if (onChunk) onChunk(`[Production Agent] Generating Storyboard for target platform: ${platform}...`);
    const creativeDecision = context.sharedDataSnapshot?.['creative-decision'] || task.objective;
    const storyboard = StoryboardEngine.getInstance().generateStoryboard(
      creativeDecision,
      context.brandMemory
    );
    if (onChunk) onChunk(`[Production Agent] Created Storyboard: "${storyboard.title}" with ${storyboard.scenes.length} scenes.`);

    let imageCost = 0;
    let videoCost = 0;
    let totalImages = 0;
    let totalVideos = 0;
    const allVideoUrls: string[] = [];

    // 2. Iterate through storyboard shots to produce assets
    for (const scene of storyboard.scenes) {
      if (onChunk) onChunk(`[Production Agent] Producing Scene ${scene.index + 1}: ${scene.title}...`);
      
      for (const shot of scene.shots) {
        // Image Generation
        const imageProvider = ModelRouter.routeImage(task);
        const imageAdapter = MediaAdapterFactory.getImageAdapter(imageProvider);
        if (onChunk) onChunk(`[Production Agent] [Shot ${shot.index + 1}] Rendering image using ${imageProvider}...`);
        
        const imageRes = await imageAdapter.generateImage({
          prompt: `${shot.imagePrompt}, visual description: ${shot.visualDescription}, style: ${storyboard.editingStyle}, grade: ${storyboard.colorGrade}`,
          aspectRatio: storyboard.aspectRatio === '9:16' ? '9:16' : '16:9',
          quality: "standard"
        });
        
        const imageUrl = imageRes.images[0]?.url || `/assets/generated_${imageProvider}_shot_${shot.id}.png`;
        shot.generatedImageUrl = imageUrl;
        imageCost += imageRes.metrics.costUsd;
        totalImages++;

        // Update performance history
        PerformanceHistory.getInstance().recordExecution(
          imageProvider,
          imageAdapter.supportedModels[0],
          true,
          imageRes.metrics.latencyMs,
          imageRes.metrics.costUsd,
          0
        );

        // Video Generation
        const videoProvider = ModelRouter.routeVideo(task);
        const videoAdapter = MediaAdapterFactory.getVideoAdapter(videoProvider);
        if (onChunk) onChunk(`[Production Agent] [Shot ${shot.index + 1}] Animating video via ${videoProvider}...`);
        
        const videoRes = await videoAdapter.generateVideo({
          prompt: `${shot.videoPrompt}, camera motion: ${shot.cameraMotion}, transition: ${shot.transitionIn}`,
          imageUrl: imageUrl,
          aspectRatio: storyboard.aspectRatio === '9:16' ? '9:16' : '16:9',
          durationSeconds: shot.durationSeconds
        });

        const videoUrl = videoRes.videoUrl || `/assets/generated_${videoProvider}_shot_${shot.id}.mp4`;
        shot.generatedVideoUrl = videoUrl;
        videoCost += videoRes.metrics.costUsd;
        allVideoUrls.push(videoUrl);
        totalVideos++;

        // Update performance history
        PerformanceHistory.getInstance().recordExecution(
          videoProvider,
          videoAdapter.supportedModels[0],
          true,
          videoRes.metrics.latencyMs,
          videoRes.metrics.costUsd,
          0
        );
      }
    }

    // 3. Save Storyboard in shared execution context for downstream EditorAgent
    context.sharedDataSnapshot.storyboard = storyboard;
    // Format output with list of generated assets
    const totalLatency = Date.now() - startTime;
    const totalCost = imageCost + videoCost;

    const outputText = `Production Plan Completed.\n` +
      `- Storyboard: "${storyboard.title}"\n` +
      `- Total Scenes: ${storyboard.scenes.length}\n` +
      `- Images Rendered: ${totalImages}\n` +
      `- Videos Rendered: ${totalVideos}\n` +
      `- Asset URLs:\n` +
      allVideoUrls.map((url, i) => `  ${i + 1}. ${url}`).join('\n') + `\n` +
      `- Total Production Cost: $${totalCost.toFixed(3)}`;

    return {
      id: `res-${Date.now()}`,
      taskId: task.id,
      output: outputText,
      rawResponse: { storyboard, allVideoUrls, imageCost, videoCost },
      metrics: {
        latencyMs: totalLatency,
        costUsd: totalCost,
        inputTokens: totalImages * 100,
        outputTokens: totalVideos * 100
      },
      status: "success"
    };
  }

  public validate(result: AgentResult): boolean {
    return result.status === "success" && !!result.rawResponse?.storyboard;
  }

  public async cleanup(): Promise<void> {
    console.log(`[Production Agent] Cleaning up local render paths...`);
  }
}
