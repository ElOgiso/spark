import { IAnalyticsService } from "../domain/contracts";
import { AnalyticsInsight } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";
import {
  getStoredPlatformAnalytics,
  platformAnalyticsToInsights,
  syncConnectedPlatformAnalytics,
  type PlatformAnalyticsRecord,
} from "./analyticsPipeline";

const defaultAnalyticsInsights: AnalyticsInsight[] = [];

export class AnalyticsService implements IAnalyticsService {
  private getFullState() {
    return loadPersistedState<any>() || {};
  }

  private saveFullState(updates: any) {
    const current = this.getFullState();
    savePersistedState({ ...current, ...updates });
  }

  async getAnalyticsInsights(): Promise<AnalyticsInsight[]> {
    // Prefer live-synced insights from platform analytics map
    const map = getStoredPlatformAnalytics();
    const records = Object.values(map);
    if (records.length > 0) {
      return platformAnalyticsToInsights(records);
    }

    const state = this.getFullState();
    if (!state.analyticsInsights) {
      this.saveFullState({ analyticsInsights: defaultAnalyticsInsights });
      return defaultAnalyticsInsights;
    }
    return state.analyticsInsights;
  }

  /** Force re-ingest from all connected OAuth platforms. */
  async syncLivePlatformAnalytics(): Promise<{
    records: PlatformAnalyticsRecord[];
    insights: AnalyticsInsight[];
  }> {
    const result = await syncConnectedPlatformAnalytics();
    this.saveFullState({
      analyticsInsights: result.insights,
      platformAnalytics: getStoredPlatformAnalytics(),
    });
    return { records: result.records, insights: result.insights };
  }

  getPlatformAnalyticsMap(): Record<string, PlatformAnalyticsRecord> {
    return getStoredPlatformAnalytics();
  }
}

export const analyticsService = new AnalyticsService();
