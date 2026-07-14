import { ExecutionTask } from "../domain/runtime/ExecutionTask";
import { Capability } from "../domain/runtime/Capability";

export interface ExecutionRequirements {
  requiredCapabilities: Capability[];
  minimumContextWindow: number;
  latencyPreference: "low" | "balanced" | "throughput";
  reliabilityThreshold: number;
}

export class CapabilityAnalyzer {
  /**
   * Evaluates the execution requirements of a task based on its parameters and required capabilities.
   * Note: The analyzer specifies capabilities and constraints, but NEVER chooses a model or provider.
   */
  public static analyze(task: ExecutionTask): ExecutionRequirements {
    const requiredCapabilities = [...task.capabilities];
    
    // Determine minimum context window constraints
    let minimumContextWindow = 4096;
    if (requiredCapabilities.includes(Capability.LONG_CONTEXT)) {
      minimumContextWindow = 32768;
    }

    // Determine latency bounds
    let latencyPreference: ExecutionRequirements["latencyPreference"] = "balanced";
    if (task.priority === "high") {
      latencyPreference = "low";
    }

    // Determine reliability threshold
    let reliabilityThreshold = 70;
    if (task.priority === "high") {
      reliabilityThreshold = 85;
    }

    return {
      requiredCapabilities,
      minimumContextWindow,
      latencyPreference,
      reliabilityThreshold
    };
  }
}
