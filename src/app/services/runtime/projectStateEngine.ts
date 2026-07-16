// ── Project State Engine ──────────────────────────────────────────────
// Manages the explicit lifecycle and state transitions of SPARK projects.
// Singleton – obtain via ProjectStateEngine.getInstance().

export type ProjectState =
  | 'Planning'
  | 'Researching'
  | 'Storyboarding'
  | 'Generating'
  | 'Reviewing'
  | 'Editing'
  | 'Publishing'
  | 'Published'
  | 'Learning'
  | 'Archived';

export class ProjectStateEngine {
  private static instance: ProjectStateEngine;
  private currentStates: Map<string, ProjectState> = new Map();

  private constructor() {}

  public static getInstance(): ProjectStateEngine {
    if (!ProjectStateEngine.instance) {
      ProjectStateEngine.instance = new ProjectStateEngine();
    }
    return ProjectStateEngine.instance;
  }

  public getProjectState(projectId: string): ProjectState {
    return this.currentStates.get(projectId) || 'Planning';
  }

  public updateProjectState(projectId: string, newState: ProjectState): void {
    const oldState = this.getProjectState(projectId);
    this.currentStates.set(projectId, newState);
    console.log(`[ProjectStateEngine] Project "${projectId}" transitioned: ${oldState} ➔ ${newState}`);
  }

  public clear(): void {
    this.currentStates.clear();
  }
}
