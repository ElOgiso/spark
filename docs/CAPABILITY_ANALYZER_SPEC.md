# Capability Analyzer Specification

This document defines the interface and capability mapping contract for the SPARK Capability Analyzer. The analyzer evaluates task types to determine model capability requirements.

---

## 1. Capability Interface Contract

```typescript
export type CapabilityType =
  | "webSearch"
  | "longContext"
  | "structuredOutput"
  | "deepReasoning"
  | "writing"
  | "styleConsistency"
  | "toneAdaptation"
  | "strategicPlanning"
  | "decisionSynthesis";

export interface CapabilityRequirements {
  required: CapabilityType[];
  preferred: CapabilityType[];
  minimumContextTokens: number;
}

export interface ICapabilityAnalyzer {
  /**
   * Evaluates the parameters of a task to determine required model capabilities.
   * Does not know about provider implementations (Gemini, OpenAI, Claude).
   */
  analyzeTask(
    taskType: "research" | "creative" | "director" | string,
    payload: any
  ): Promise<CapabilityRequirements>;
}
```

---

## 2. Standard Agent Capability Profiles

When executing tasks, agents query the analyzer and receive standard profiles:

### A. Research Agent Profile
* **Task Type**: `"research"`
* **Required Capabilities**:
  - `webSearch`: Access to live search indexes for trending hashtags.
  - `longContext`: Ingesting large past metrics sheets (100k+ tokens).
  - `structuredOutput`: Returning strictly formatted JSON objects.
  - `deepReasoning`: Evaluating trend velocities.

### B. Creative Agent Profile
* **Task Type**: `"creative"`
* **Required Capabilities**:
  - `writing`: Natural language generation.
  - `styleConsistency`: Aligning scripts to brand formatting rules.
  - `toneAdaptation`: Adjusting voice traits (e.g. conversational vs. formal).

### C. Director Agent Profile
* **Task Type**: `"director"` (or Review coordinator)
* **Required Capabilities**:
  - `strategicPlanning`: Outlining multi-step campaign sequences.
  - `decisionSynthesis`: Resolving quality scores based on safety checks.
  - `deepReasoning`: Executing pre-flight evaluations.
