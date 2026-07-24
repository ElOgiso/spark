import {
  ExecutiveDirectorSummaryRow,
  ExecutiveSessionRow,
  MemoryItemRow,
  ExecutiveConversationMessageRow,
  ExecutiveTimelineRow,
} from "../backend/database.types";
import { WorkingMemory } from "./workingMemory";

/**
 * Immutable Executive Context Snapshot passed into Runtime and AI Providers.
 */
export interface ExecutiveContext {
  summary: ExecutiveDirectorSummaryRow | null;
  session: ExecutiveSessionRow | null;
  memory: MemoryItemRow[];
  workingMemory: WorkingMemory;
  conversation: ExecutiveConversationMessageRow[];
  timeline: ExecutiveTimelineRow[];
}

export const createEmptyExecutiveContext = (): ExecutiveContext => ({
  summary: null,
  session: null,
  memory: [],
  workingMemory: { context: {} },
  conversation: [],
  timeline: [],
});
