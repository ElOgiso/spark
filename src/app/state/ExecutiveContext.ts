export type ExecutiveContext = {
  summary?: any;
  session?: any;
  memory: any[];
  workingMemory: { context: Record<string, unknown> };
  conversation: any[];
  timeline: any[];
};

export function createEmptyExecutiveContext(): ExecutiveContext {
  return {
    summary: null,
    session: null,
    memory: [],
    workingMemory: { context: {} },
    conversation: [],
    timeline: [],
  };
}
