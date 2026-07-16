import { ProviderSelection } from "../modelRouter";

export class SharedExecutionContext {
  private taskId: string;
  private data: Map<string, any> = new Map();
  private citations: Set<string> = new Set();
  private assets: string[] = [];
  private summaries: string[] = [];
  private routingDecisions: ProviderSelection[] = [];

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  public getTaskId(): string {
    return this.taskId;
  }

  public get(key: string): any {
    return this.data.get(key);
  }

  public set(key: string, value: any): void {
    this.data.set(key, value);
    console.log(`[Shared Context] Stored execution data key: "${key}"`);
  }

  public addCitation(citation: string): void {
    this.citations.add(citation);
  }

  public getCitations(): string[] {
    return Array.from(this.citations);
  }

  public addAsset(assetUrl: string): void {
    this.assets.push(assetUrl);
  }

  public getAssets(): string[] {
    return [...this.assets];
  }

  public addSummary(summary: string): void {
    this.summaries.push(summary);
  }

  public getSummaries(): string[] {
    return [...this.summaries];
  }

  public addRoutingDecision(decision: ProviderSelection): void {
    this.routingDecisions.push(decision);
  }

  public getRoutingDecisions(): ProviderSelection[] {
    return [...this.routingDecisions];
  }

  public clear(): void {
    this.data.clear();
    this.citations.clear();
    this.assets = [];
    this.summaries = [];
    this.routingDecisions = [];
  }
}
