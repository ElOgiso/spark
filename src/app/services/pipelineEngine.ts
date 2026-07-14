export interface PipelineDefinition {
  id: string;
  name: string;
  steps: string[];
}

export class PipelineEngine {
  private static readonly PIPELINES: Record<string, PipelineDefinition> = {
    default: {
      id: "default",
      name: "Standard SPARK Media Pipeline",
      steps: [
        "discovery",
        "research",
        "creative",
        "production",
        "review",
        "publishing",
        "analytics",
        "learning"
      ]
    },
    video: {
      id: "video",
      name: "Video Production Pipeline",
      steps: [
        "concept",
        "scripting",
        "storyboard",
        "rendering",
        "approval",
        "distribution"
      ]
    }
  };

  public static getPipeline(pipelineId: string): PipelineDefinition | null {
    return this.PIPELINES[pipelineId] || this.PIPELINES["default"];
  }

  public static getNextStep(pipelineId: string, currentStep: string): string | null {
    const pipeline = this.getPipeline(pipelineId);
    if (!pipeline) return null;
    const idx = pipeline.steps.indexOf(currentStep.toLowerCase());
    if (idx === -1 || idx === pipeline.steps.length - 1) return null;
    return pipeline.steps[idx + 1];
  }

  public static getPreviousStep(pipelineId: string, currentStep: string): string | null {
    const pipeline = this.getPipeline(pipelineId);
    if (!pipeline) return null;
    const idx = pipeline.steps.indexOf(currentStep.toLowerCase());
    if (idx <= 0) return null;
    return pipeline.steps[idx - 1];
  }
}
