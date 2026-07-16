// ── Creative Director Engine ──────────────────────────────────────────
// Analyzes objectives, campaign templates, capabilities, and outputs reasoning.
// Singleton – obtain via CreativeDirectorEngine.getInstance().

export type ContentType =
  | 'image'
  | 'video'
  | 'carousel'
  | 'article'
  | 'podcast'
  | 'documentary'
  | 'short form'
  | 'talking head'
  | 'product commercial'
  | 'meme'
  | 'thread'
  | 'infographic'
  | 'animation';

export type PlatformType =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'linkedin'
  | 'twitter'
  | 'universal';

export type ExecutionModeType = 'single' | 'campaign' | 'series' | 'live' | 'batch' | 'remix' | 'repurpose';

export type PromotionPlanType = 'affiliate' | 'naturalProduct' | 'none';

export type WorkflowTemplateType =
  | 'ProductLaunch'
  | 'Podcast'
  | 'Tutorial'
  | 'TalkingHead'
  | 'UGC'
  | 'Documentary'
  | 'BrandStory'
  | 'Interview'
  | 'TrendReaction'
  | 'Course'
  | 'MusicVideo'
  | 'Explainer';

export interface CreativeDecision {
  contentType: ContentType;
  workflowTemplate: WorkflowTemplateType;
  executionMode: ExecutionModeType;
  deliverables: string[];
  platform: PlatformType;
  audience: string;
  creativeGoal: string;
  emotion: string;
  hookStyle: string;
  ctaStyle: string;
  estimatedDuration: string;
  editingExpected: boolean;
  promotionPlan: PromotionPlanType;
  assetRequirements: string[];
  requiredCapabilities: string[];
  confidence: number;
  creativeReasoning: string;
}

export class CreativeDirectorEngine {
  private static instance: CreativeDirectorEngine;
  private currentDecisions: Map<string, CreativeDecision> = new Map();

  private constructor() {}

  public static getInstance(): CreativeDirectorEngine {
    if (!CreativeDirectorEngine.instance) {
      CreativeDirectorEngine.instance = new CreativeDirectorEngine();
    }
    return CreativeDirectorEngine.instance;
  }

  /**
   * Evaluates user objective and context parameters to formulate a CreativeDecision.
   */
  public analyzeObjective(projectId: string, objective: string): CreativeDecision {
    console.log(`[CreativeDirectorEngine] Formulating creative decision blueprint for objective: "${objective.slice(0, 50)}"`);

    const lower = objective.toLowerCase();
    let contentType: ContentType = 'video';
    let platform: PlatformType = 'universal';
    let workflowTemplate: WorkflowTemplateType = 'UGC';
    let creativeReasoning = 'UGC short-form vertical video is recommended for high engagement rates.';
    let requiredCapabilities = ['videoGeneration', 'editing', 'hookAnalysis', 'voice', 'music', 'subtitles'];
    let executionMode: ExecutionModeType = 'single';
    let deliverables = ['Video', 'Subtitles', 'TikTok Caption'];
    let estimatedDuration = '30 sec';

    if (lower.includes('campaign') || lower.includes('30-day') || lower.includes('series')) {
      executionMode = 'campaign';
      deliverables.push('Thumbnail', 'X Thread', 'LinkedIn Post');
    }

    if (lower.includes('launch') || lower.includes('product') || lower.includes('keyboard')) {
      contentType = 'product commercial';
      platform = 'youtube';
      workflowTemplate = 'ProductLaunch';
      creativeReasoning = 'Product launch requires high-fidelity showcase detailing features with soft music and professional voice.';
      requiredCapabilities.push('productVideo');
      estimatedDuration = '60 sec';
      deliverables = ['Video', 'Thumbnail', 'SEO Title', 'Description'];
    } else if (lower.includes('tiktok') || lower.includes('short') || lower.includes('reel')) {
      contentType = 'short form';
      platform = 'tiktok';
      workflowTemplate = 'UGC';
      creativeReasoning = 'TikTok formats perform best with horizontal-safe vertical alignment, under 30s, and high action pacing.';
      estimatedDuration = '18 sec';
    } else if (lower.includes('image') || lower.includes('photo') || lower.includes('graphic')) {
      contentType = 'image';
      platform = 'instagram';
      workflowTemplate = 'BrandStory';
      creativeReasoning = 'Single image prompt selected to outline visual aesthetics of product branding.';
      requiredCapabilities = ['imageGeneration', 'characterConsistency'];
      estimatedDuration = '1 image';
      deliverables = ['Thumbnail', 'Instagram Caption'];
    }

    const decision: CreativeDecision = {
      contentType,
      workflowTemplate,
      executionMode,
      deliverables,
      platform,
      audience: lower.includes('dev') || lower.includes('tech') ? 'Software Developers & Tech Enthusiasts' : 'General Audience',
      creativeGoal: `Maximize engagement and conversions for objective: ${objective.slice(0, 30)}`,
      emotion: contentType === 'product commercial' ? 'curiosity' : 'excitement',
      hookStyle: 'Agitative question',
      ctaStyle: 'Direct feature reveal link',
      estimatedDuration,
      editingExpected: true,
      promotionPlan: lower.includes('product') ? 'naturalProduct' : 'none',
      assetRequirements: ['Main product render clip', 'B-roll keyboard switch typing close up'],
      requiredCapabilities,
      confidence: 94,
      creativeReasoning,
    };

    this.currentDecisions.set(projectId, decision);
    return decision;
  }

  public getDecision(projectId: string): CreativeDecision | undefined {
    return this.currentDecisions.get(projectId);
  }
}
