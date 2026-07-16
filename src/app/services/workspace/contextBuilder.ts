import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ExecutionContext } from "../../domain/runtime/IDepartmentAgent";
import { WorkspaceIntelligence } from "./workspaceIntelligence";
import { BrandMemoryEngine } from "./brandMemoryEngine";
import { ExecutiveKnowledgeGraph } from "./executiveKnowledgeGraph";
import { SharedExecutionContext } from "../runtime/sharedExecutionContext";

export class ContextBuilder {
  /**
   * Aggregates intelligence assets to produce a single, cohesive context frame.
   */
  public static build(
    task: ExecutionTask,
    sharedCtx?: SharedExecutionContext
  ): ExecutionContext {
    const workspaceSnapshot = WorkspaceIntelligence.getInstance().getWorkspaceSnapshot();
    const brandMemory = BrandMemoryEngine.getInstance().getBrandMemory();
    const graphSubset = ExecutiveKnowledgeGraph.getInstance().getGraphSubset(task.brandId || "brand-default", 2);

    const sharedDataSnapshot: Record<string, any> = {};
    if (sharedCtx) {
      sharedDataSnapshot.citations = sharedCtx.getCitations();
      sharedDataSnapshot.assets = sharedCtx.getAssets();
      sharedDataSnapshot.summaries = sharedCtx.getSummaries();
      sharedDataSnapshot.routingDecisions = sharedCtx.getRoutingDecisions();
      
      sharedDataSnapshot.research = sharedCtx.get("research");
      sharedDataSnapshot.creative = sharedCtx.get("creative");
      sharedDataSnapshot.production = sharedCtx.get("production");
      sharedDataSnapshot.storyboard = sharedCtx.get("storyboard");
      sharedDataSnapshot.review = sharedCtx.get("review");
      sharedDataSnapshot.analytics = sharedCtx.get("analytics");
      sharedDataSnapshot.learning = sharedCtx.get("learning");
    }

    return {
      workspaceId: task.workspaceId || "default",
      brandId: task.brandId || "default",
      variables: {},
      workspaceSnapshot,
      brandMemory,
      knowledgeGraphSubset: graphSubset,
      sharedDataSnapshot
    };
  }
}
