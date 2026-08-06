import { ICalendarService } from "../domain/contracts";
import { PublishJob, ExportPackage } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultPublishJobs: PublishJob[] = [];

const defaultExportPackages: ExportPackage[] = [];

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
