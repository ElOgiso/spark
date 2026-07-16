import { Capability } from "../domain/runtime/Capability";
import { WorkspaceIntelligence } from "./workspace/workspaceIntelligence";
import { BrandMemoryEngine } from "./workspace/brandMemoryEngine";
import { ExecutiveKnowledgeGraph } from "./workspace/executiveKnowledgeGraph";

export interface ToolDefinition {
  id: string;
  name: string;
  capabilities: Capability[];
  health: "healthy" | "degraded" | "unhealthy";
  permissions: string[];
  version: string;
  execute: (args: any) => Promise<any>;
}

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  private constructor() {
    // Populate default baseline tools
    this.register({
      id: "tool-web-search",
      name: "Web Search",
      capabilities: [Capability.WEB_SEARCH],
      health: "healthy",
      permissions: ["network"],
      version: "1.0.0",
      execute: async (args) => {
        console.log(`[Tool Web Search] Searching for: ${JSON.stringify(args)}`);
        return { results: [`Search results matching context for: ${args.query || ""}`] };
      }
    });

    this.register({
      id: "tool-image-gen",
      name: "Image Generation",
      capabilities: [Capability.IMAGE_GENERATION],
      health: "healthy",
      permissions: ["write"],
      version: "1.0.0",
      execute: async (args) => {
        console.log(`[Tool Image Gen] Generating image asset: ${JSON.stringify(args)}`);
        return { url: `/assets/generated_asset_${Date.now()}.png` };
      }
    });

    this.register({
      id: "tool-code-exec",
      name: "Code Execution",
      capabilities: [Capability.STRATEGIC_REASONING],
      health: "healthy",
      permissions: ["sandbox"],
      version: "1.1.0",
      execute: async (args) => {
        console.log(`[Tool Code Exec] Sandbox code execution: ${JSON.stringify(args)}`);
        return { status: "success", output: "Console log statement result" };
      }
    });

    this.register({
      id: "tool-supabase",
      name: "Supabase DB",
      capabilities: [Capability.ANALYTICS, Capability.LEARNING],
      health: "healthy",
      permissions: ["database"],
      version: "2.0.0",
      execute: async (args) => {
        console.log(`[Tool Supabase] DB query execution: ${JSON.stringify(args)}`);
        return { status: "success", rows: [] };
      }
    });

    this.register({
      id: "tool-memory",
      name: "Brand Memory",
      capabilities: [Capability.LEARNING],
      health: "healthy",
      permissions: ["write"],
      version: "1.0.0",
      execute: async (args) => {
        console.log(`[Tool Brand Memory] Appending learned hook/guideline: ${JSON.stringify(args)}`);
        if (args.text) {
          BrandMemoryEngine.getInstance().updateMemory("guidelines", [args.text]);
        }
        return { status: "success" };
      }
    });

    this.register({
      id: "tool-workspace",
      name: "Workspace Intelligence",
      capabilities: [Capability.LONG_CONTEXT],
      health: "healthy",
      permissions: ["read"],
      version: "1.0.0",
      execute: async () => {
        console.log("[Tool Workspace] Fetching current workspace snapshot");
        return WorkspaceIntelligence.getInstance().getWorkspaceSnapshot();
      }
    });

    this.register({
      id: "tool-knowledge-graph",
      name: "Knowledge Graph",
      capabilities: [Capability.STRATEGIC_REASONING],
      health: "healthy",
      permissions: ["read"],
      version: "1.0.0",
      execute: async (args) => {
        console.log(`[Tool Knowledge Graph] Tracing related items for: ${args.id}`);
        return ExecutiveKnowledgeGraph.getInstance().getGraphSubset(args.id || "brand-default", 2);
      }
    });

    this.register({
      id: "tool-scheduling",
      name: "Scheduling Manager",
      capabilities: [Capability.PUBLISHING],
      health: "healthy",
      permissions: ["write"],
      version: "1.0.0",
      execute: async (args) => {
        console.log(`[Tool Scheduling] Scheduling post job at: ${args.time}`);
        return { jobId: `pj-${Date.now()}`, status: "Scheduled" };
      }
    });
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
    console.log(`[Tool Registry] ToolRegistered: Registered ${tool.name} (v${tool.version})`);
  }

  public getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolsForCapabilities(caps: Capability[]): ToolDefinition[] {
    return this.getAllTools().filter(tool =>
      tool.capabilities.some(c => caps.includes(c))
    );
  }
}
