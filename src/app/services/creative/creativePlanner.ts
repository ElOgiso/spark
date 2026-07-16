// ── Creative Planner ──────────────────────────────────────────────────
// The bridge service between Research and Storyboard.
// Singleton – obtain via CreativePlanner.getInstance().

export interface CampaignPlan {
  projectId: string;
  campaignAngle: string;
  hook: string;
  emotionalArc: string;
  cta: string;
  pacing: 'slow' | 'balanced' | 'fast';
  targetAudience: string;
  createdAt: string;
}

export class CreativePlanner {
  private static instance: CreativePlanner;
  private plans: Map<string, CampaignPlan> = new Map();

  private constructor() {}

  public static getInstance(): CreativePlanner {
    if (!CreativePlanner.instance) {
      CreativePlanner.instance = new CreativePlanner();
    }
    return CreativePlanner.instance;
  }

  /**
   * Generates a creative planning structure based on the initial research context.
   */
  public generatePlan(
    projectId: string,
    objective: string,
    researchSummary: string,
    brandMemory: any
  ): CampaignPlan {
    const tone = brandMemory?.brandVoice || 'informative';
    const preferredHooks = brandMemory?.writingStyle?.preferredHooks || [];
    const preferredCTAs = brandMemory?.writingStyle?.preferredCTAs || [];

    const hook = preferredHooks[Math.floor(Math.random() * preferredHooks.length)] ||
      'This single framework changes how we scale media output forever:';
    
    const cta = preferredCTAs[Math.floor(Math.random() * preferredCTAs.length)] ||
      'Scale your automated workflow today.';

    const plan: CampaignPlan = {
      projectId,
      campaignAngle: `Leverage technical insights about "${objective.slice(0, 40)}" targeting growth engineers.`,
      hook,
      emotionalArc: 'Curiosity ➔ Agitation of scaling pain points ➔ Solution validation',
      cta,
      pacing: tone.includes('energetic') || objective.toLowerCase().includes('tiktok') ? 'fast' : 'balanced',
      targetAudience: brandMemory?.about?.audiencePersonas?.[0] || 'Technical creators and founders',
      createdAt: new Date().toISOString(),
    };

    this.plans.set(projectId, plan);
    console.log(`[CreativePlanner] Generated creative plan for: ${projectId}`);
    return plan;
  }

  public getPlan(projectId: string): CampaignPlan | undefined {
    return this.plans.get(projectId);
  }
}
