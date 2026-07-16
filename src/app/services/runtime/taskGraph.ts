import { ExecutionTask } from "../../domain/runtime/ExecutionTask";

export interface TaskNode {
  task: ExecutionTask;
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
}

export class TaskGraph {
  private nodes: Map<string, TaskNode> = new Map();

  public addNode(task: ExecutionTask, dependencies: string[] = []): void {
    this.nodes.set(task.id, {
      task,
      dependencies,
      status: "pending"
    });
    console.log(`[Task Graph] Added node: ${task.id} dependencies: [${dependencies.join(", ")}]`);
  }

  public getExecutableNodes(): ExecutionTask[] {
    const executable: ExecutionTask[] = [];

    this.nodes.forEach((node) => {
      if (node.status !== "pending") return;

      const depsSatisfied = node.dependencies.every(depId => {
        const depNode = this.nodes.get(depId);
        return depNode ? depNode.status === "completed" : true;
      });

      if (depsSatisfied) {
        executable.push(node.task);
      }
    });

    return executable;
  }

  public markNodeStatus(taskId: string, status: "pending" | "running" | "completed" | "failed"): void {
    const node = this.nodes.get(taskId);
    if (node) {
      node.status = status;
      console.log(`[Task Graph] Node ${taskId} transitioned to: ${status}`);
    }
  }

  public isComplete(): boolean {
    return Array.from(this.nodes.values()).every(node => node.status === "completed" || node.status === "failed");
  }

  public hasErrors(): boolean {
    return Array.from(this.nodes.values()).some(node => node.status === "failed");
  }

  public clear(): void {
    this.nodes.clear();
  }
}
