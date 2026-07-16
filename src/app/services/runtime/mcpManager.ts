// ── MCP Manager ───────────────────────────────────────────────────────
// Connects, health-checks, and maps capabilities of local/remote MCP Servers.
// Singleton – obtain via McpManager.getInstance().

import { IntegrationManifest } from './integrationManifest';
import { ServiceRegistry } from './serviceRegistry';

export interface McpServerConnection {
  id: string;
  name: string;
  url: string;
  connected: boolean;
  healthStatus: 'healthy' | 'degraded' | 'offline';
  registeredCapabilities: string[];
}

export class McpManager {
  private static instance: McpManager;
  private connections: Map<string, McpServerConnection> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  private registerDefaults(): void {
    this.registerServer({
      id: 'higgsfield-mcp',
      name: 'Higgsfield MCP Server',
      url: 'http://localhost:8500',
      connected: true,
      healthStatus: 'healthy',
      registeredCapabilities: ['videoGeneration', 'imageToVideo', 'characterTraining'],
    });
  }

  public registerServer(conn: McpServerConnection): void {
    this.connections.set(conn.id.toLowerCase(), conn);
    console.log(`[McpManager] Registered MCP Server: ${conn.name} at ${conn.url}`);

    // Map to ServiceRegistry
    const manifest: IntegrationManifest = {
      id: conn.id,
      provider: conn.name,
      category: 'MediaGeneration',
      type: 'MCP',
      version: '1.0.0',
      capabilities: conn.registeredCapabilities,
      executionStrategy: 'sync',
      fallbackPolicy: { retryCount: 2, allowFallback: true },
      permissions: { read: true, write: true, execute: true, destructive: false },
      authentication: { type: 'None' },
    };

    ServiceRegistry.getInstance().register(manifest);
  }

  public removeServer(serverId: string): void {
    this.connections.delete(serverId.toLowerCase());
    ServiceRegistry.getInstance().remove(serverId);
    console.log(`[McpManager] Removed MCP Server: ${serverId}`);
  }

  public listServers(): McpServerConnection[] {
    return Array.from(this.connections.values());
  }

  public healthCheck(serverId: string): 'healthy' | 'degraded' | 'offline' {
    const conn = this.connections.get(serverId.toLowerCase());
    return conn ? conn.healthStatus : 'offline';
  }
}
