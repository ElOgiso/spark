import { IAnalyticsService } from "../domain/contracts";
import { AnalyticsInsight } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultAnalyticsInsights: AnalyticsInsight[] = [
  {
    id: "ai1",
    title: "Exclusivity Pattern Outperforming",
    description: "The 'Nobody talks about this' hook angle achieved a 3.2x higher click-through-rate on TikTok and Shorts relative to traditional tutorials.",
    metric: "3.2x",
    change: "+220%",
    type: "worked",
    bestHook: "\"Nobody talks about this, but...\"",
    bestFormat: "Short-form clips (45s)",
    bestPlatformFit: "TikTok",
  },
  {
    id: "ai2",
    title: "Local Identity Lift",
    description: "Scripts explicitly mentioning local context (such as Lagos tech hubs or Nigerian currency) get 2.3x higher share velocity across WhatsApp and Twitter.",
    metric: "2.3x",
    change: "+130%",
    type: "worked",
    bestHook: "Mo fẹ sọ ohun ti ko si ẹnikan...",
    bestFormat: "Short-form & Threads",
    bestPlatformFit: "TikTok + Instagram",
  },
  {
    id: "ai3",
    title: "High Drop-Off on Long Technical Intros",
    description: "Technical tutorial series episodes that spent more than 20 seconds on conceptual introductions suffered a severe 38% user drop-off in the first minute.",
    metric: "-38%",
    change: "-40%",
    type: "failed",
    bestHook: "Immediate action demo",
    bestFormat: "Short-form or Quick tutorial",
    bestPlatformFit: "YouTube",
  }
];

export class AnalyticsService implements IAnalyticsService {
  private getFullState() {
    return loadPersistedState<any>() || {};
  }

  private saveFullState(updates: any) {
    const current = this.getFullState();
    savePersistedState({ ...current, ...updates });
  }

  async getAnalyticsInsights(): Promise<AnalyticsInsight[]> {
    const state = this.getFullState();
    if (!state.analyticsInsights) {
      this.saveFullState({ analyticsInsights: defaultAnalyticsInsights });
      return defaultAnalyticsInsights;
    }
    return state.analyticsInsights;
  }
}

export const analyticsService = new AnalyticsService();
