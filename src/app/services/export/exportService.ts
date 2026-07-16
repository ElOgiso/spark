// ── Export Service ───────────────────────────────────────────────────
// Packages completed renders into distributable export bundles.
// Singleton – obtain via ExportService.getInstance().

import type { RenderJob } from '../render/renderService';
import type { TimelineProject } from '../../domain/editor/EditorTypes';

export interface ExportMetadata {
  title: string;
  description: string;
  tags: string[];
  thumbnail?: string;
  platform: string;
}

export interface ExportPackage {
  id: string;
  renderJobId: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  description: string;
  tags: string[];
  platform: string;
  resolution: { width: number; height: number };
  durationSeconds: number;
  fileSize: number;
  createdAt: string;
  status: 'ready' | 'uploading' | 'published';
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export class ExportService {
  private static instance: ExportService;
  private packages: Map<string, ExportPackage> = new Map();

  private constructor() {}

  public static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  /**
   * Creates an export package from a completed render job and project metadata.
   */
  public createExportPackage(
    renderJob: RenderJob,
    project: TimelineProject,
    metadata: ExportMetadata,
  ): ExportPackage {
    if (!renderJob.outputUrl) {
      throw new Error(`Render job ${renderJob.id} has no output URL – cannot package.`);
    }

    const durationSeconds =
      project.frameRate > 0 ? project.durationFrames / project.frameRate : 0;

    // Estimate file size from bitrate and duration
    const fileSize = Math.round(
      (project.exportSettings.bitrate / 8) * durationSeconds,
    );

    const pkg: ExportPackage = {
      id: generateId('export'),
      renderJobId: renderJob.id,
      videoUrl: renderJob.outputUrl,
      thumbnailUrl:
        metadata.thumbnail ??
        `/thumbnails/${project.id}/thumb_${Date.now()}.jpg`,
      title: metadata.title,
      description: metadata.description,
      tags: [...metadata.tags],
      platform: metadata.platform,
      resolution: { ...project.exportSettings.resolution },
      durationSeconds: parseFloat(durationSeconds.toFixed(2)),
      fileSize,
      createdAt: new Date().toISOString(),
      status: 'ready',
    };

    this.packages.set(pkg.id, pkg);
    console.log(
      `[ExportService] Created export package ${pkg.id} for render ${renderJob.id} – "${metadata.title}"`,
    );
    return pkg;
  }

  /** Retrieves a stored export package by ID. */
  public getPackage(packageId: string): ExportPackage | undefined {
    return this.packages.get(packageId);
  }
}
