import { AgentDefinition } from "./AgentDefinition";
import { ExecutionTask } from "./ExecutionTask";
import { ProviderSelection } from "../../services/modelRouter";
import { AgentResult } from "./AgentResult";
import { WorkspaceSnapshot } from "../../services/workspace/workspaceIntelligence";
import { BrandMemory } from "../../services/workspace/brandMemoryEngine";
import { GraphRelationship } from "../../services/workspace/executiveKnowledgeGraph";

export interface ExecutionContext {
  workspaceId: string;
  brandId: string;
  variables: Record<string, any>;
  workspaceSnapshot: WorkspaceSnapshot;
  brandMemory: BrandMemory;
  knowledgeGraphSubset: GraphRelationship[];
  sharedDataSnapshot: Record<string, any>;
}

export interface IDepartmentAgent {
  definition: AgentDefinition;
  initialize(): Promise<void>;
  canExecute(task: ExecutionTask): boolean;
  prepare(task: ExecutionTask): Promise<void>;
  execute(task: ExecutionTask, context: ExecutionContext, selection: ProviderSelection, onChunk?: (text: string) => void): Promise<AgentResult>;
  validate(result: AgentResult): boolean;
  cleanup(): Promise<void>;
}
