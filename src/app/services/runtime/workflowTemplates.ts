// ── Workflow Templates ────────────────────────────────────────────────
// Predefined structural pipeline maps for various creative campaigns.
// Singleton – obtain via WorkflowTemplates.getInstance().

export type WorkflowType =
  | 'Product Launch'
  | 'Podcast'
  | 'Documentary'
  | 'UGC'
  | 'Tutorial'
  | 'Course'
  | 'Advertisement'
  | 'Music Video'
  | 'Interview'
  | 'Talking Head'
  | 'YouTube'
  | 'LinkedIn'
  | 'TikTok';

export interface WorkflowTemplate {
  name: WorkflowType;
  steps: string[];
  suggestedAspect: '16:9' | '9:16' | '1:1';
  maxDurationSeconds: number;
}

export class WorkflowTemplates {
  private static instance: WorkflowTemplates;
  private templates: Map<WorkflowType, WorkflowTemplate> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): WorkflowTemplates {
    if (!WorkflowTemplates.instance) {
      WorkflowTemplates.instance = new WorkflowTemplates();
    }
    return WorkflowTemplates.instance;
  }

  private registerDefaults(): void {
    const list: WorkflowTemplate[] = [
      {
        name: 'Product Launch',
        steps: ['research', 'creative', 'production', 'media-intelligence', 'editing-decision', 'editor', 'review', 'publishing'],
        suggestedAspect: '16:9',
        maxDurationSeconds: 120,
      },
      {
        name: 'TikTok',
        steps: ['creative', 'production', 'media-intelligence', 'editing-decision', 'editor', 'publishing'],
        suggestedAspect: '9:16',
        maxDurationSeconds: 45,
      },
      {
        name: 'UGC',
        steps: ['research', 'creative', 'production', 'media-intelligence', 'editing-decision', 'editor', 'review', 'publishing'],
        suggestedAspect: '9:16',
        maxDurationSeconds: 60,
      },
      {
        name: 'Advertisement',
        steps: ['research', 'creative', 'production', 'media-intelligence', 'editing-decision', 'editor', 'review', 'publishing'],
        suggestedAspect: '1:1',
        maxDurationSeconds: 30,
      },
    ];

    list.forEach((t) => this.templates.set(t.name, t));
  }

  public getTemplate(name: WorkflowType): WorkflowTemplate | undefined {
    return this.templates.get(name);
  }
}
