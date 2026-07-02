import { ICalendarService } from "../domain/contracts";
import { PublishJob, ExportPackage } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultPublishJobs: PublishJob[] = [
  { id: "pj1", productionId: "p4", title: "Building a Personal Brand in 2026", platform: "LinkedIn", scheduledTime: "Thu 9:00 AM", status: "Scheduled" },
  { id: "pj2", productionId: "p7", title: "AI Editing Tools Comparison 2026", platform: "YouTube", scheduledTime: "Thu 2:00 PM", status: "Scheduled" },
  { id: "pj3", productionId: "p8", title: "Free Tools Every Creator Needs", platform: "TikTok", scheduledTime: "Wed 8:00 PM", status: "Export Ready" },
];

const defaultExportPackages: ExportPackage[] = [
  { id: "ep1", productionId: "p8", title: "Free Tools Every Creator Needs", size: "48.2 MB", formats: ["9:16 Vertical Cut (TikTok)", "Metadata JSON"], readyAt: "2h ago" }
];

export class CalendarService implements ICalendarService {
  private getFullState() {
    return loadPersistedState<any>() || {};
  }

  private saveFullState(updates: any) {
    const current = this.getFullState();
    savePersistedState({ ...current, ...updates });
  }

  async getPublishJobs(): Promise<PublishJob[]> {
    const state = this.getFullState();
    if (!state.publishJobs) {
      this.saveFullState({ publishJobs: defaultPublishJobs });
      return defaultPublishJobs;
    }
    return state.publishJobs;
  }

  async getExportPackages(): Promise<ExportPackage[]> {
    const state = this.getFullState();
    if (!state.exportPackages) {
      this.saveFullState({ exportPackages: defaultExportPackages });
      return defaultExportPackages;
    }
    return state.exportPackages;
  }

  async schedulePublishJob(id: string, scheduledTime: string): Promise<PublishJob> {
    const publishJobs = await this.getPublishJobs();
    let updatedJob: PublishJob | null = null;
    const updated = publishJobs.map((j) => {
      if (j.id === id) {
        updatedJob = { ...j, scheduledTime, status: "Scheduled" as const };
        return updatedJob;
      }
      return j;
    });
    if (!updatedJob) {
      throw new Error(`Publish job with id ${id} not found`);
    }
    this.saveFullState({ publishJobs: updated });
    return updatedJob;
  }

  async createPublishJob(jobData: Omit<PublishJob, "id">): Promise<PublishJob> {
    const publishJobs = await this.getPublishJobs();
    const newJob: PublishJob = {
      ...jobData,
      id: `pj-${Date.now()}`
    };
    const updated = [...publishJobs, newJob];
    this.saveFullState({ publishJobs: updated });
    return newJob;
  }

  async createExportPackage(pkgData: Omit<ExportPackage, "id">): Promise<ExportPackage> {
    const exportPackages = await this.getExportPackages();
    const newPkg: ExportPackage = {
      ...pkgData,
      id: `ep-${Date.now()}`
    };
    const updated = [...exportPackages, newPkg];
    this.saveFullState({ exportPackages: updated });
    return newPkg;
  }
}

export const calendarService = new CalendarService();
