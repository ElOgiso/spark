import { IReviewService } from "../domain/contracts";
import { ReviewItem } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultReviewItems: ReviewItem[] = [
  {
    id: "r1",
    productionId: "p1",
    title: "5 Viral Marketing Tactics That Actually Work in 2026",
    account: "YouTube",
    series: "Marketing Masterclass",
    status: "Pending Review",
    dateCreated: "2026-07-01",
    scriptSnippet: "Everyone tells you to just 'post consistently' — but that is the fastest way to burn out in 2026. Here is the actual mathematical formula...",
    conceptText: "Unpack 5 unconventional growth models used by the top 1% of creators, localized entirely with West African case studies.",
    openingMoment: "Show failed marketing campaign burning money animation (0–3s)",
    qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" }
  },
  {
    id: "r2",
    productionId: "p2",
    title: "The Psychology Behind Viral Content",
    account: "TikTok",
    series: "Content Science",
    status: "Pending Review",
    dateCreated: "2026-07-01",
    scriptSnippet: "Why did you click on this video? It wasn't the thumbnail. It was a cognitive loophole called the curiosity gap. Let me show you how to code it into your edits.",
    conceptText: "A fast-paced short dissecting psychological triggers like anticipation, micro-rewards, and local relatability.",
    openingMoment: "Failed campaign burning money animation",
    qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" }
  },
  {
    id: "r3",
    productionId: "p3",
    title: "How AI Creates Engaging Stories",
    account: "Instagram",
    series: "AI Craft",
    status: "Needs Edit",
    dateCreated: "2026-06-30",
    scriptSnippet: "AI stories aren't artificial. They are a reflection of human psychology aggregated over a billion data points. Let's see how smart brands use this...",
    conceptText: "Carousel deck contrasting dry factual storytelling with high-retention structured narrative hooks.",
    openingMoment: "Split screen: Failed vs Successful campaign with contrast lighting",
    qualityCheck: { brandSafety: "Passed", policyCheck: "Warning", technicalCheck: "Passed" }
  },
  {
    id: "r4",
    productionId: "p4",
    title: "Building a Personal Brand in 2026",
    account: "LinkedIn",
    series: "Career Growth",
    status: "Approved",
    dateCreated: "2026-06-29",
    scriptSnippet: "Your brand isn't what you say. It is what people search for when you leave the room. Here's Tunde's 3-step blueprint for tech leaders in Nigeria.",
    conceptText: "High-value professional growth guide connecting local prestige with modern content authority models.",
    openingMoment: "Tunde directly presenting",
    qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" }
  }
];

export class ReviewService implements IReviewService {
  private getFullState() {
    return loadPersistedState<any>() || {};
  }

  private saveFullState(updates: any) {
    const current = this.getFullState();
    savePersistedState({ ...current, ...updates });
  }

  async getReviewItems(): Promise<ReviewItem[]> {
    const state = this.getFullState();
    if (!state.reviewItems) {
      this.saveFullState({ reviewItems: defaultReviewItems });
      return defaultReviewItems;
    }
    return state.reviewItems;
  }

  async approveReviewItem(id: string): Promise<ReviewItem> {
    const reviewItems = await this.getReviewItems();
    let updatedReview: ReviewItem | null = null;
    const updated = reviewItems.map((r) => {
      if (r.id === id) {
        updatedReview = { ...r, status: "Approved" as const };
        return updatedReview;
      }
      return r;
    });
    if (!updatedReview) {
      throw new Error(`Review item with id ${id} not found`);
    }
    this.saveFullState({ reviewItems: updated });
    return updatedReview;
  }

  async rejectOrRequestEditReviewItem(id: string): Promise<ReviewItem> {
    const reviewItems = await this.getReviewItems();
    let updatedReview: ReviewItem | null = null;
    const updated = reviewItems.map((r) => {
      if (r.id === id) {
        updatedReview = { ...r, status: "Needs Edit" as const };
        return updatedReview;
      }
      return r;
    });
    if (!updatedReview) {
      throw new Error(`Review item with id ${id} not found`);
    }
    this.saveFullState({ reviewItems: updated });
    return updatedReview;
  }
}

export const reviewService = new ReviewService();
