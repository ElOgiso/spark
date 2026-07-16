// ── Render Service ───────────────────────────────────────────────────
// Manages render jobs for timeline projects.
// Singleton – obtain via RenderService.getInstance().

import type { TimelineProject, ExportSettings } from '../../domain/editor/EditorTypes';

export interface RenderJob {
  id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  outputUrl: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export class RenderService {
  private static instance: RenderService;
  private jobs: Map<string, RenderJob> = new Map();

  private constructor() {}

  public static getInstance(): RenderService {
    if (!RenderService.instance) {
      RenderService.instance = new RenderService();
    }
    return RenderService.instance;
  }

  /**
   * Starts a render job for the given project and export settings.
   * Simulates progress from queued → rendering → completed.
   */
  public startRender(project: TimelineProject, settings: ExportSettings): RenderJob {
    const job: RenderJob = {
      id: generateId('render'),
      status: 'queued',
      progress: 0,
      outputUrl: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    this.jobs.set(job.id, job);
    console.log(`[RenderService] Queued render job ${job.id} for project "${project.name}"`);

    // Simulate rendering progress
    this.simulateProgress(job, project, settings);

    return job;
  }

  /** Returns the current state of a render job. */
  public getRenderStatus(jobId: string): RenderJob | undefined {
    return this.jobs.get(jobId);
  }

  /** Cancels a queued or in-progress render job. */
  public cancelRender(jobId: string): RenderJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    if (job.status === 'queued' || job.status === 'rendering') {
      job.status = 'cancelled';
      job.completedAt = new Date().toISOString();
      console.log(`[RenderService] Cancelled render job ${jobId}`);
    }
    return job;
  }

  // ── Simulation ─────────────────────────────────────────────────────

  private simulateProgress(
    job: RenderJob,
    project: TimelineProject,
    settings: ExportSettings,
  ): void {
    // Immediately transition to rendering
    job.status = 'rendering';
    job.progress = 0;

    const steps = 10;
    let current = 0;

    const tick = () => {
      // If cancelled while simulating, stop
      if (job.status === 'cancelled') return;

      current++;
      job.progress = Math.min(Math.round((current / steps) * 100), 100);

      if (current >= steps) {
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        job.outputUrl = `/renders/${project.id}/${job.id}.${settings.format}`;
        console.log(`[RenderService] Render job ${job.id} completed → ${job.outputUrl}`);
      } else {
        setTimeout(tick, 200);
      }
    };

    // Start first tick immediately
    setTimeout(tick, 200);
  }
}
