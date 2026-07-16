import { ProviderSelection } from "./modelRouter";
import { ExecutionTask } from "../domain/runtime/ExecutionTask";
import { AgentResult } from "../domain/runtime/AgentResult";
import { ExecutivePolicyEngine } from "./executivePolicyEngine";
import { ToolRegistry } from "./toolRegistry";
import { AdapterFactory } from "./providerAdapters";
import { IProviderAdapter, ProviderToolDefinition } from "../domain/runtime/IProviderAdapter";
import { PerformanceHistory } from "./performanceHistory";
import { RuntimeEvents } from "./runtime/runtimeEvents";

export class ExecutionAdapter {
  /**
   * Single entry point for all provider execution.
   */
  public static async execute(
    task: ExecutionTask,
    selection: ProviderSelection,
    onChunk?: (chunk: string) => void
  ): Promise<AgentResult> {
    const events = RuntimeEvents.getInstance();

    // 1. Verify execution permission
    const isPermitted = ExecutivePolicyEngine.canExecuteDepartment(task.department, task.automationMode);
    if (!isPermitted) {
      events.emit("ProviderFailed", { taskId: task.id, provider: selection.provider, reason: "Policy blocked" });
      throw new Error(`Execution blocked by Policy Engine for department: ${task.department}`);
    }

    // 2. Gather tools and translate to provider tool definitions
    const toolRegistry = ToolRegistry.getInstance();
    const activeTools = toolRegistry.getToolsForCapabilities(task.capabilities);
    const providerTools: ProviderToolDefinition[] = activeTools
      .filter(t => t.health === "healthy")
      .map(t => ({
        type: "function" as const,
        function: {
          name: t.id,
          description: `${t.name} (v${t.version})`,
          parameters: { type: "object", properties: {} }
        }
      }));

    // 3. Resolve adapter from factory
    const adapter: IProviderAdapter = AdapterFactory.getAdapter(selection.provider);
    events.emit("ProviderSelected", { taskId: task.id, provider: selection.provider, model: selection.model });

    // 4. Translate and execute
    const shouldIncludeTools = adapter.supportsToolCalling() && providerTools.length > 0;
    const payload = adapter.translateRequest(task, shouldIncludeTools ? providerTools : []);

    events.emit("ProviderStarted", { taskId: task.id, provider: selection.provider });
    const startTime = Date.now();

    let rawResponse: any;
    try {
      rawResponse = await adapter.execute(payload, onChunk);
    } catch (err: any) {
      const latency = Date.now() - startTime;
      PerformanceHistory.getInstance().recordExecution(
        selection.provider, selection.model, false, latency, 0, 0
      );
      events.emit("ProviderFailed", { taskId: task.id, provider: selection.provider, error: err.message });
      throw err;
    }

    // 5. Normalize response
    const result = adapter.normalizeResponse(rawResponse, task.id);
    const latency = Date.now() - startTime;

    // 6. Record execution metrics in PerformanceHistory
    PerformanceHistory.getInstance().recordExecution(
      selection.provider,
      result.model || selection.model,
      result.status === "success",
      latency,
      result.metrics.costUsd,
      result.metrics.inputTokens + result.metrics.outputTokens
    );

    events.emit("ProviderCompleted", {
      taskId: task.id,
      provider: selection.provider,
      model: result.model,
      latencyMs: latency,
      costUsd: result.metrics.costUsd,
      tokens: result.metrics.inputTokens + result.metrics.outputTokens
    });

    return result;
  }
}
