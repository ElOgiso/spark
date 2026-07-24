export interface WorkingMemory {
  productionId?: string;
  campaignId?: string;
  reviewId?: string;
  objectiveId?: string;
  department?: string;
  context: Record<string, unknown>;
}

export const createInitialWorkingMemory = (): WorkingMemory => ({
  context: {},
});
