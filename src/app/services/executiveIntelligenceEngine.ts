import { on, emit, SparkEvent } from "./eventBus";
import { ExecutiveContext } from "../state/executiveContext";
import { reflectionService } from "./executiveIntelligence/reflectionService";
import { summaryUpdateService } from "./executiveIntelligence/summaryUpdateService";
import { sessionUpdateService } from "./executiveIntelligence/sessionUpdateService";
import { memoryRepository } from "../backend/repositories/memoryRepository";
import { executiveTimelineRepository } from "../backend/repositories/executiveTimelineRepository";
import { MemoryItemRow } from "../backend/database.types";

class ExecutiveIntelligenceEngineManager {
  private activeContextGetter?: () => ExecutiveContext;

  public initialize(contextGetter: () => ExecutiveContext) {
    this.activeContextGetter = contextGetter;
    this.setupListeners();
  }

  private setupListeners() {
    on(SparkEvent.MessageCreated, async (msg) => {
      if (!this.activeContextGetter) return;
      const ctx = this.activeContextGetter();

      // Step 1: Reflection & Fact Extraction
      const extractedFacts = reflectionService.extractFactsFromMessage(msg.text, ctx);
      const newMemoryRows: MemoryItemRow[] = [];

      for (const fact of extractedFacts) {
        const created = await memoryRepository.addMemoryItem({
          brand_id: msg.brand_id,
          category: fact.category,
          title: fact.title,
          description: fact.description,
          source: "Executive Reflection",
          confidence: fact.confidence,
          importance: fact.importance,
          confirmed: false,
          evidence: { trigger_message_id: msg.id },
          affected_systems: ["Creative", "Review"],
          archived: false,
        });
        if (created) newMemoryRows.push(created);
      }

      if (newMemoryRows.length > 0) {
        emit(SparkEvent.MemoryUpdated, newMemoryRows);
      }

      // Step 2: Summary Update
      const updatedSummary = await summaryUpdateService.updateSummary(
        msg.brand_id,
        ctx,
        msg.text
      );
      if (updatedSummary) {
        emit(SparkEvent.SummaryUpdated, updatedSummary);
      }

      // Step 3: Session Update (Last-active-wins)
      const updatedSession = await sessionUpdateService.updateSession(
        msg.brand_id,
        ctx
      );
      if (updatedSession) {
        emit(SparkEvent.SessionUpdated, updatedSession);
      }

      // Step 4: Record Milestone in Timeline if significant
      if (msg.sender === "user" && msg.text.length > 20) {
        const milestone = await executiveTimelineRepository.recordMilestone({
          brand_id: msg.brand_id,
          session_id: msg.session_id,
          type: "CREATOR_DIRECTIVE",
          description: `Directive issued: "${msg.text.substring(0, 80)}..."`,
        });
        if (milestone) {
          emit(SparkEvent.TimelineRecorded, milestone);
        }
      }
    });
  }
}

export const executiveIntelligenceEngine = new ExecutiveIntelligenceEngineManager();
