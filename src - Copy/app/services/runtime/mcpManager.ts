export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  type: "github" | "notion" | "supabase" | "figma" | "custom";
  status: "connected" | "disconnected" | "connecting";
  tools: string[];
}

export class McpManager {
  private static instance: McpManager;
  private servers: Map<string, McpServerConfig> = new Map();

  constructor() {
    this.registerDefaultProviders();
  }

  static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  private registerDefaultProviders() {
    const defaults: McpServerConfig[] = [
      { id: "github", name: "GitHub MCP Server", url: "https://api.github.com/mcp", type: "github", status: "connected", tools: ["repo_search", "code_commit", "issue_tracker"] },
      { id: "notion", name: "Notion Brain MCP", url: "https://api.notion.com/v1/mcp", type: "notion", status: "connected", tools: ["search_brain", "query_database", "retrieve_page"] },
      { id: "supabase", name: "Supabase DB MCP", url: "https://api.supabase.com/mcp", type: "supabase", status: "connected", tools: ["execute_sql", "sync_table", "inspect_schema"] },
      { id: "figma", name: "Figma Assets MCP", url: "https://api.figma.com/v1/mcp", type: "figma", status: "connected", tools: ["inspect_canvas", "export_asset", "get_styles"] },
    ];

    defaults.forEach((s) => this.servers.set(s.id, s));
  }

  getServers(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  async connectMcpServer(url: string, type: McpServerConfig["type"] = "custom"): Promise<boolean> {
    const id = `mcp-${Date.now()}`;
    const newServer: McpServerConfig = {
      id,
      name: `MCP Server (${type})`,
      url,
      type,
      status: "connected",
      tools: ["custom_query", "invoke_tool"],
    };
    this.servers.set(id, newServer);
    return true;
  }
}
