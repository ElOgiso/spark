import { VideoUnderstandingProvider } from "./research/providers/VideoUnderstandingProvider";
import { YouTubeResearchProvider } from "./research/providers/YouTubeResearchProvider";
import { ResearchSourceService } from "./research/researchSourceService";
import { ResearchDepartmentService } from "./research/researchDepartmentService";

export interface SPARKCapability {
  id: string;
  name: string;
  category: "Research" | "Production" | "Analytics" | "Memory" | "Orchestration";
  description: string;
  status: "active" | "standby" | "maintenance";
  providerClass: any;
}

export class CapabilityRegistry {
  private static registry = new Map<string, SPARKCapability>();

  static initialize(): void {
    if (this.registry.size > 0) return;

    this.register({
      id: "video-understanding-provider",
      name: "VideoUnderstandingProvider",
      category: "Research",
      description: "Multi-modal AI vision engine for deep single-video analysis (hook, pacing, storytelling, editing, CTA).",
      status: "active",
      providerClass: VideoUnderstandingProvider,
    });

    this.register({
      id: "research-source-provider",
      name: "ResearchSourceProvider",
      category: "Research",
      description: "Official YouTube & platform connector for public channel intelligence & uploads playlist mining.",
      status: "active",
      providerClass: YouTubeResearchProvider,
    });

    this.register({
      id: "research-source-service",
      name: "ResearchSourceService",
      category: "Research",
      description: "Ingestion and quota-managed sync for inspiration channels & video assets.",
      status: "active",
      providerClass: ResearchSourceService,
    });

    this.register({
      id: "research-department-service",
      name: "ResearchDepartmentService",
      category: "Orchestration",
      description: "Executive Memory updates, ResearchPattern synthesis, and Viral Spark generation.",
      status: "active",
      providerClass: ResearchDepartmentService,
    });
  }

  static register(capability: SPARKCapability): void {
    this.registry.set(capability.id, capability);
    this.registry.set(capability.name, capability);
  }

  static getCapability(idOrName: string): SPARKCapability | undefined {
    this.initialize();
    return this.registry.get(idOrName);
  }

  static listCapabilities(): SPARKCapability[] {
    this.initialize();
    const unique = new Set<SPARKCapability>(Array.from(this.registry.values()));
    return Array.from(unique);
  }
}

// Auto-initialize capability registry on import
CapabilityRegistry.initialize();
