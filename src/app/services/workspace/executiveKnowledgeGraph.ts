export interface GraphRelationship {
  sourceId: string;
  sourceType: "workspace" | "brand" | "campaign" | "asset" | "production" | "analytics" | "learning" | "task" | "character" | "voice" | "location" | "prop" | "product" | "music" | "font" | "transition" | "style" | "template";
  targetId: string;
  targetType: "workspace" | "brand" | "campaign" | "asset" | "production" | "analytics" | "learning" | "task" | "character" | "voice" | "location" | "prop" | "product" | "music" | "font" | "transition" | "style" | "template";
  type: string;
}

export class ExecutiveKnowledgeGraph {
  private static instance: ExecutiveKnowledgeGraph;
  private relationships: GraphRelationship[] = [];

  private constructor() {
    this.initializeBaselineGraph();
  }

  public static getInstance(): ExecutiveKnowledgeGraph {
    if (!ExecutiveKnowledgeGraph.instance) {
      ExecutiveKnowledgeGraph.instance = new ExecutiveKnowledgeGraph();
    }
    return ExecutiveKnowledgeGraph.instance;
  }

  private initializeBaselineGraph(): void {
    this.addRelationship("workspace-default", "workspace", "brand-default", "brand", "owns");
    this.addRelationship("brand-default", "brand", "campaign-launch", "campaign", "owns");
    this.addRelationship("brand-default", "brand", "campaign-showcase", "campaign", "owns");
    this.addRelationship("campaign-launch", "campaign", "asset-logo", "asset", "references");
    this.addRelationship("campaign-showcase", "campaign", "asset-framework-chart", "asset", "references");
    this.addRelationship("campaign-launch", "campaign", "production-intro", "production", "triggers");
  }

  public addRelationship(
    sourceId: string,
    sourceType: GraphRelationship["sourceType"],
    targetId: string,
    targetType: GraphRelationship["targetType"],
    type: string
  ): void {
    // Check duplicates
    const exists = this.relationships.some(
      r => r.sourceId === sourceId && r.targetId === targetId && r.type === type
    );
    if (!exists) {
      this.relationships.push({ sourceId, sourceType, targetId, targetType, type });
      console.log(`[Knowledge Graph] Added link: (${sourceId}:${sourceType}) --[${type}]--> (${targetId}:${targetType})`);
    }
  }

  public getRelatedNodes(
    sourceId: string,
    sourceType: GraphRelationship["sourceType"],
    targetType: GraphRelationship["targetType"]
  ): string[] {
    return this.relationships
      .filter(r => r.sourceId === sourceId && r.sourceType === sourceType && r.targetType === targetType)
      .map(r => r.targetId);
  }

  public getGraphSubset(startId: string, maxDepth: number = 2): GraphRelationship[] {
    const subset: GraphRelationship[] = [];
    const visited = new Set<string>();
    let queue: string[] = [startId];
    let depth = 0;

    while (queue.length > 0 && depth < maxDepth) {
      const nextQueue: string[] = [];
      for (const id of queue) {
        if (visited.has(id)) continue;
        visited.add(id);

        const links = this.relationships.filter(r => r.sourceId === id || r.targetId === id);
        for (const link of links) {
          if (!subset.some(s => s.sourceId === link.sourceId && s.targetId === link.targetId && s.type === link.type)) {
            subset.push(link);
          }
          const neighbor = link.sourceId === id ? link.targetId : link.sourceId;
          nextQueue.push(neighbor);
        }
      }
      queue = nextQueue;
      depth++;
    }

    return subset;
  }
}
