// ── Executive Director ────────────────────────────────────────────────
// The central coordinator ("CEO") overseeing scheduling, budget, and recovery.
// Singleton – obtain via ExecutiveDirector.getInstance().

import { ExecutionTask } from '../../domain/runtime/ExecutionTask';
import { ProjectStateEngine } from './projectStateEngine';
import { ReviewPolicyEngine, ApprovalPolicy } from './reviewPolicy';
import { WorkflowTemplates, WorkflowTemplate, WorkflowType } from './workflowTemplates';
import { RecoveryIntelligence, RecoveryStrategy } from './recoveryIntelligence';
import { ConfidenceEngine, ConfidenceReport } from './confidenceEngine';
import { CreativeDirectorEngine, CreativeDecision } from '../creative/CreativeDirectorEngine';
import { ServiceRegistry } from './serviceRegistry';

export class ExecutiveDirector {
  private static instance: ExecutiveDirector;

  private constructor() {}

  public static getInstance(): ExecutiveDirector {
    if (!ExecutiveDirector.instance) {
      ExecutiveDirector.instance = new ExecutiveDirector();
    }
    return ExecutiveDirector.instance;
  }

  /**
   * Approves or customizes the pipeline DAG structure based on templates.
   */
  public selectWorkflow(type: WorkflowType): WorkflowTemplate {
    const template = WorkflowTemplates.getInstance().getTemplate(type);
    if (!template) {
      throw new Error(`Workflow template "${type}" not registered in registry.`);
    }
    console.log(`[ExecutiveDirector] Initialized campaign workflow blueprint: ${type}`);
    return template;
  }

  /**
   * Resolves the optimal provider service vendor-agnostically via the ServiceRegistry.
   */
  public routeTaskProvider(task: ExecutionTask, capability: string): string {
    const service = ServiceRegistry.getInstance().resolveOptimalService(capability);
    const resolved = service ? service.id : 'google';
    console.log(`[ExecutiveDirector] Resolved capability "${capability}" dynamically to service: ${resolved}`);
    return resolved;
  }

  /**
   * Handles step failures and triggers recovery actions.
   */
  public handleStepFailure(task: ExecutionTask, errorMsg: string, attempt: number): RecoveryStrategy {
    return RecoveryIntelligence.getInstance().evaluateFailure(task, errorMsg, attempt);
  }

  /**
   * Audits task output quality and scores confidence ratings.
   */
  public auditStep(
    task: ExecutionTask,
    outputLength: number,
    hasKeywords: boolean,
    hasCitations: boolean
  ): ConfidenceReport {
    return ConfidenceEngine.getInstance().generateReport(task.department, outputLength, hasKeywords, hasCitations);
  }

  /**
   * Checks human gatekeeper rules before publishing content.
   */
  public checkPublishApproval(projectId: string, promptText: string): boolean {
    const policy = ReviewPolicyEngine.getInstance().getPolicyForProject(promptText);
    ProjectStateEngine.getInstance().updateProjectState(projectId, 'Reviewing');
    
    if (policy === 'AutoApprove') {
      console.log('[ExecutiveDirector] Review Policy evaluated as AutoApprove. Proceeding.');
      return true;
    }
    console.log(`[ExecutiveDirector] Review Policy requires manual review: ${policy}.`);
    return false;
  }

  public formulateCreativeDecision(projectId: string, objective: string): CreativeDecision {
    return CreativeDirectorEngine.getInstance().analyzeObjective(projectId, objective);
  }
}
