import { IReviewService } from "../domain/contracts";
import { ReviewItem } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultReviewItems: ReviewItem[] = [];

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
