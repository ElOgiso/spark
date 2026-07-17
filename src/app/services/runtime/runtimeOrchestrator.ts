import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { TaskState } from "../../domain/runtime/TaskState";
import { TaskGraph } from "./taskGraph";
import { RuntimeEvents } from "./runtimeEvents";
import { RuntimeRecovery } from "./runtimeRecovery";
import { SharedExecutionContext } from "./sharedExecutionContext";
import { ExecutionManager } from "../executionManager";
import { CapabilityAnalyzer } from "../capabilityAnalyzer";
import { AgentRegistry } from "../agentRegistry";
import { AgentDispatcher } from "../agentDispatcher";
import { ModelRouter, ProviderSelection } from "../modelRouter";
import { AgentResult } from "../../domain/runtime/AgentResult";
import { ProjectStateEngine } from "./projectStateEngine";
import { ExecutiveDirector } from "./executiveDirector";
import { CreativePlanner } from "../creative/creativePlanner";
import { MediaIntelligence } from "../media/mediaIntelligence";
import { ConfidenceEngine } from "./confidenceEngine";

export class RuntimeOrchestrator {
  private static instance: RuntimeOrchestrator;
  private taskGraph = new TaskGraph();

  private constructor() {}

  public static getInstance(): RuntimeOrchestrator {
    if (!RuntimeOrchestrator.instance) {
      RuntimeOrchestrator.instance = new RuntimeOrchestrator();
    }
    return RuntimeOrchestrator.instance;
  }

  /**
   * Orchestrates the 10-step pipeline DAG flow asynchronously.
   */
  public async orchestrateTask(
    parentTask: ExecutionTask,
    onChunk?: (text: string, department: string) => void
  ): Promise<AgentResult> {
    console.log(`[Runtime Orchestrator] Starting orchestration for parent task: ${parentTask.id}`);
    
    this.taskGraph.clear();
    const sharedContext = new SharedExecutionContext(parentTask.id);
    const director = ExecutiveDirector.getInstance();
    const stateEngine = ProjectStateEngine.getInstance();

    // 1. Initialize State to Planning
    stateEngine.updateProjectState(parentTask.id, "Planning");

    // Build the 10 sequential pipeline tasks
    const researchTask: ExecutionTask = {
      ...parentTask,
      id: `task-research-${Date.now()}`,
      department: "research",
      objective: `Perform depth research on topic: ${parentTask.objective}`,
      status: TaskState.QUEUED
    };

    const creativeDecisionTask: ExecutionTask = {
      ...parentTask,
      id: `task-creative-decision-${Date.now()}`,
      department: "creative-decision" as any,
      objective: `Determine high-level content strategy, platform choices, capabilities, and creative reasoning`,
      status: TaskState.QUEUED
    };

    const planningTask: ExecutionTask = {
      ...parentTask,
      id: `task-planning-${Date.now()}`,
      department: "creative",
      objective: `Build campaign plan and copywriting directive`,
      status: TaskState.QUEUED
    };

    const storyboardTask: ExecutionTask = {
      ...parentTask,
      id: `task-storyboard-${Date.now()}`,
      department: "production",
      objective: `Generate storyboard execution plan`,
      status: TaskState.QUEUED
    };

    const generationTask: ExecutionTask = {
      ...parentTask,
      id: `task-generation-${Date.now()}`,
      department: "production",
      objective: `Produce raw video and image assets matching storyboard`,
      status: TaskState.QUEUED
    };

    const analysisTask: ExecutionTask = {
      ...parentTask,
      id: `task-analysis-${Date.now()}`,
      department: "media-intelligence",
      objective: `Evaluate technical and creative quality of produced assets`,
      status: TaskState.QUEUED
    };

    const decisionTask: ExecutionTask = {
      ...parentTask,
      id: `task-decision-${Date.now()}`,
      department: "editing-decision",
      objective: `Determine if post-processing editing is required`,
      status: TaskState.QUEUED
    };

    const editorTask: ExecutionTask = {
      ...parentTask,
      id: `task-editor-${Date.now()}`,
      department: "editor",
      objective: `Assemble, transition, and grade video layers`,
      status: TaskState.QUEUED
    };

    const reviewTask: ExecutionTask = {
      ...parentTask,
      id: `task-review-${Date.now()}`,
      department: "review",
      objective: `Conduct brand safety and guideline audit`,
      status: TaskState.QUEUED
    };

    const publishingTask: ExecutionTask = {
      ...parentTask,
      id: `task-publishing-${Date.now()}`,
      department: "publishing",
      objective: `Schedule or post production package to social nodes`,
      status: TaskState.QUEUED
    };

    const learningTask: ExecutionTask = {
      ...parentTask,
      id: `task-learning-${Date.now()}`,
      department: "learning",
      objective: `Inject performance results back to content memory`,
      status: TaskState.QUEUED
    };

    // Add tasks to DAG
    this.taskGraph.addNode(researchTask, []);
    this.taskGraph.addNode(creativeDecisionTask, [researchTask.id]);
    this.taskGraph.addNode(planningTask, [creativeDecisionTask.id]);
    this.taskGraph.addNode(storyboardTask, [planningTask.id]);
    this.taskGraph.addNode(generationTask, [storyboardTask.id]);
    this.taskGraph.addNode(analysisTask, [generationTask.id]);
    this.taskGraph.addNode(decisionTask, [analysisTask.id]);
    this.taskGraph.addNode(editorTask, [decisionTask.id]);
    this.taskGraph.addNode(reviewTask, [editorTask.id]);
    this.taskGraph.addNode(publishingTask, [reviewTask.id]);
    this.taskGraph.addNode(learningTask, [publishingTask.id]);

    let lastResult: AgentResult = {
      id: "fallback",
      taskId: parentTask.id,
      output: "",
      rawResponse: null,
      metrics: { latencyMs: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 },
      status: "failure"
    };

    while (!this.taskGraph.isComplete()) {
      const executable = this.taskGraph.getExecutableNodes();
      if (executable.length === 0) break;

      const promises = executable.map(async (task) => {
        // Verify prerequisites
        const deps = this.taskGraph.getDependencies(task.id);
        const allDepsSucceeded = deps.every(depId => {
          const depNode = this.taskGraph.getNode(depId);
          return depNode && depNode.status === "completed";
        });

        if (!allDepsSucceeded) {
          this.taskGraph.markNodeStatus(task.id, "failed");
          console.error(`[RuntimeOrchestrator] Prerequisites missing for task ${task.id} (${task.department}). Aborting.`);
          RuntimeEvents.getInstance().emit("TaskFailed", { taskId: task.id, department: task.department, productionId: task.productionId, error: "Prerequisites failed" });
          return;
        }

        // Check if this task can be skipped from existing reasoning (Resume support)
        const existingReasoning = (parentTask as any).existingReasoning;
        let isAlreadyCompleted = false;
        let outputForContext = "";
        let rawResponseForContext: any = null;

        if (existingReasoning) {
          if (task.department === "research" && existingReasoning.research) {
            isAlreadyCompleted = true;
            outputForContext = existingReasoning.research.notes || "";
          } else if ((task.department as string) === "creative-decision" && existingReasoning.planning) {
            isAlreadyCompleted = true;
            outputForContext = "Creative Decision formulated (Loaded from cache)";
          } else if (task.department === "creative" && existingReasoning.planning) {
            isAlreadyCompleted = true;
            outputForContext = existingReasoning.planning.outline || "";
          } else if (task.objective.includes("storyboard") && existingReasoning.storyboard) {
            isAlreadyCompleted = true;
            outputForContext = `Loaded storyboard: ${existingReasoning.storyboard.scenes?.length || 0} scenes`;
            rawResponseForContext = existingReasoning.storyboard;
          } else if (task.objective.includes("Produce") && existingReasoning.generation && existingReasoning.generation.assets?.length > 0) {
            isAlreadyCompleted = true;
            outputForContext = `Loaded generated assets:\n` +
              existingReasoning.generation.assets.map((url: string, i: number) => `  ${i + 1}. ${url}`).join('\n');
            rawResponseForContext = {
              allVideoUrls: existingReasoning.generation.assets,
              videoCost: existingReasoning.generation.metadata?.costUsd || 0
            };
          } else if ((task.department as string) === "media-intelligence" && existingReasoning.editing) {
            isAlreadyCompleted = true;
            outputForContext = "Media Intelligence passed (Loaded from cache)";
          } else if ((task.department as string) === "editing-decision" && existingReasoning.editing) {
            isAlreadyCompleted = true;
            outputForContext = "Editing Decision passed (Loaded from cache)";
          } else if (task.department === "editor" && existingReasoning.editing) {
            isAlreadyCompleted = true;
            outputForContext = "Editing render succeeded (Loaded from cache)";
            rawResponseForContext = existingReasoning.editing.timeline;
          }
        }

        if (isAlreadyCompleted) {
          console.log(`[RuntimeOrchestrator] Skipping already completed stage: ${task.department} (${task.objective})`);
          sharedContext.set(task.department, outputForContext);
          if (rawResponseForContext) {
            if (task.objective.includes("storyboard")) {
              sharedContext.set("storyboard", rawResponseForContext);
            }
          }
          this.taskGraph.markNodeStatus(task.id, "completed");
          RuntimeEvents.getInstance().emit("TaskCompleted", {
            taskId: task.id,
            department: task.department,
            productionId: task.productionId,
            output: outputForContext,
            rawResponse: rawResponseForContext
          });
          return;
        }

        this.taskGraph.markNodeStatus(task.id, "running");
        RuntimeEvents.getInstance().emit("TaskStarted", { taskId: task.id, department: task.department, productionId: task.productionId });

        // Update Project State Engine
        if (task.department === "research") stateEngine.updateProjectState(parentTask.id, "Researching");
        else if ((task.department as string) === "creative-decision") stateEngine.updateProjectState(parentTask.id, "Planning");
        else if (task.department === "creative") stateEngine.updateProjectState(parentTask.id, "Planning");
        else if (task.objective.includes("storyboard")) stateEngine.updateProjectState(parentTask.id, "Storyboarding");
        else if (task.objective.includes("Produce")) stateEngine.updateProjectState(parentTask.id, "Generating");
        else if ((task.department as string) === "media-intelligence" || task.department === "review") stateEngine.updateProjectState(parentTask.id, "Reviewing");
        else if (task.department === "editor") stateEngine.updateProjectState(parentTask.id, "Editing");
        else if (task.department === "publishing") stateEngine.updateProjectState(parentTask.id, "Publishing");
        else if (task.department === "learning") stateEngine.updateProjectState(parentTask.id, "Learning");

        try {
          let result: any;

          // Inline Intelligence Steps (Media Intelligence, Editing Decision & Creative Director Engine)
          if ((task.department as string) === "creative-decision") {
            const decision = director.formulateCreativeDecision(parentTask.id, parentTask.objective);
            sharedContext.set("creative-decision", decision);
            
            result = {
              id: `res-creative-decision-${Date.now()}`,
              taskId: task.id,
              output: `Creative Decision formulated: Platform=${decision.platform}, Target=${decision.contentType}, Workflow=${decision.workflowTemplate}. Rationale: ${decision.creativeReasoning}`,
              rawResponse: decision,
              metrics: { latencyMs: 150, costUsd: 0, inputTokens: 0, outputTokens: 0 },
              status: "success"
            };
          } else if ((task.department as string) === "media-intelligence") {
            const productionOutput = sharedContext.get("production") || "";
            const imageUrls = (productionOutput.match(/https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp)/gi) || []);
            const videoUrls = (productionOutput.match(/https?:\/\/[^\s)]+\.(?:mp4|webm|mov)/gi) || []);
            const assets = [...videoUrls, ...imageUrls];
            
            const analysis = MediaIntelligence.getInstance().analyzeMedia(assets);
            sharedContext.set("media-analysis", analysis);
            
            result = {
              id: `res-intel-${Date.now()}`,
              taskId: task.id,
              output: `Technical Score: ${analysis.evaluation.technicalScore}/100. Creative Score: ${analysis.evaluation.creativeScore}/100. Overall: ${analysis.evaluation.overallScore}/100.`,
              rawResponse: analysis,
              metrics: { latencyMs: 200, costUsd: 0, inputTokens: 0, outputTokens: 0 },
              status: "success"
            };
          } else if ((task.department as string) === "editing-decision") {
            const analysis = sharedContext.get("media-analysis");
            const decision = analysis?.decision || { shouldEdit: true, reasons: ["Default edit required"] };
            sharedContext.set("editing-decision", decision);
            
            result = {
              id: `res-decision-${Date.now()}`,
              taskId: task.id,
              output: `Editing Required: ${decision.shouldEdit ? "YES" : "NO"}. Reasons: ${decision.reasons.join(", ")}`,
              rawResponse: decision,
              metrics: { latencyMs: 100, costUsd: 0, inputTokens: 0, outputTokens: 0 },
              status: "success"
            };
          } else {
            // General Department Agent Workflow
            const requirements = CapabilityAnalyzer.analyze(task);
            const registry = AgentRegistry.getInstance();
            const agent = AgentDispatcher.selectAgent(
              registry.getAllAgents(),
              requirements.requiredCapabilities,
              task.department
            );

            if (!agent) {
              throw new Error(`No matching agent found for department ${task.department}`);
            }

            RuntimeEvents.getInstance().emit("AgentStarted", { taskId: task.id, agentId: agent.definition.id });

            // Executive Director maps provider routing
            const defaultSelection = ModelRouter.route(task, requirements, agent.definition);
            const selection: ProviderSelection = {
              ...defaultSelection,
              provider: director.routeTaskProvider(task, requirements.requiredCapabilities[0] || "imageGeneration")
            };
            
            RuntimeEvents.getInstance().emit("ModelSelected", { taskId: task.id, provider: selection.provider, model: selection.model });
            sharedContext.addRoutingDecision(selection);

            const manager = ExecutionManager.getInstance();

            result = await RuntimeRecovery.executeWithRetry<AgentResult>(
              task,
              selection,
              async () => {
                return await manager.executeTask(
                  task,
                  selection,
                  agent,
                  sharedContext,
                  onChunk ? (text) => onChunk(text, task.department) : undefined
                );
              },
              () => {
                const retrySelection = ModelRouter.route(task, requirements, agent.definition);
                return {
                  ...retrySelection,
                  provider: director.routeTaskProvider(task, requirements.requiredCapabilities[0] || "imageGeneration")
                };
              }
            );

            // Creative Planner Integration
            if (task.department === "creative") {
              CreativePlanner.getInstance().generatePlan(parentTask.id, parentTask.objective, result.output, sharedContext.get("brandMemory"));
            }

            // Confidence engine mapping
            const report = director.auditStep(task, result.output.length, true, true);
            result.confidence = report.confidence;
            result.risk = report.risk;
            result.uncertainty = report.uncertainty;
            result.recommendedAction = report.recommendedAction;
            result.reviewNeeded = report.reviewNeeded;
          }

          sharedContext.set(task.department, result.output);
          this.taskGraph.markNodeStatus(task.id, "completed");
          RuntimeEvents.getInstance().emit("TaskCompleted", {
            taskId: task.id,
            department: task.department,
            productionId: task.productionId,
            output: result.output,
            rawResponse: result.rawResponse
          });

          lastResult = result;
        } catch (err: any) {
          this.taskGraph.markNodeStatus(task.id, "failed");
          RuntimeEvents.getInstance().emit("TaskFailed", {
            taskId: task.id,
            department: task.department,
            productionId: task.productionId,
            error: err.message
          });
          throw err;
        }
      });

      await Promise.all(promises);
    }

    // Wrap project to published state
    stateEngine.updateProjectState(parentTask.id, "Published");
    return lastResult;
  }
}
