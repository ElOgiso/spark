export interface BrandMemory {
  brandVoice: string;
  visualRules: {
    colorPalette: string[];
    logoAssets: string[];
    typography: string[];
    creativeGuidelines: string[];
  };
  writingStyle: {
    doNotUsePhrases: string[];
    preferredHooks: string[];
    preferredCTAs: string[];
    generalStyleGuidelines: string[];
  };
  about: {
    mission: string;
    vision: string;
    audiencePersonas: string[];
  };
  editingStyle?: string;
  musicPreference?: string;
  voiceStyle?: string;
  animationStyle?: string;
  cameraMovementPreference?: string;
  fontFamily?: string;
}

export class BrandMemoryEngine {
  private static instance: BrandMemoryEngine;
  private memory: BrandMemory | null = null;

  private constructor() {
    this.loadMemory();
  }

  public static getInstance(): BrandMemoryEngine {
    if (!BrandMemoryEngine.instance) {
      BrandMemoryEngine.instance = new BrandMemoryEngine();
    }
    return BrandMemoryEngine.instance;
  }

  private loadMemory(): void {
    this.memory = {
      brandVoice: "Authentic, builder-centric, authoritative but approachable, focusing on technical substance over marketing fluff.",
      visualRules: {
        colorPalette: ["#6366f1", "#1e1b4b", "#f8fafc", "#0f172a"],
        logoAssets: ["/assets/logo-main.svg", "/assets/logo-mark.svg"],
        typography: ["Geist Sans", "JetBrains Mono"],
        creativeGuidelines: [
          "Use clean glassmorphic panels for UI designs",
          "Ensure background animations are subtle and performant",
          "Never stretch or distort the primary logomarks"
        ]
      },
      writingStyle: {
        doNotUsePhrases: ["revolutionary", "disruptive", "game-changing", "paradigm shift", "supercharge"],
        preferredHooks: [
          "Building a production-ready AI agent runtime is harder than it looks.",
          "Here is how we connected 7 AI agents into a single operating system:",
          "Most content automation fails because it lacks brand memory. Here is our fix:"
        ],
        preferredCTAs: [
          "Try Spark Media OS locally today.",
          "Star the repository on GitHub and join our developer community.",
          "Let us know which department agent you want to scale next in the comments."
        ],
        generalStyleGuidelines: [
          "Use syntax-highlighted code blocks for technical context",
          "Write as if explaining to a senior engineer peer",
          "Focus on execution times, tokens, and cost savings metrics"
        ]
      },
      about: {
        mission: "To establish a premium, developer-first AI-native operating system for automated media creation.",
        vision: "A fully decentralized workspace orchestrator capable of managing 10,000 parallel channels with zero human intervention.",
        audiencePersonas: [
          "Senior Frontend Developer looking to build modern visual web tools",
          "Technical Growth Lead automating enterprise pipelines",
          "AI Researcher exploring multi-agent orchestrations"
        ]
      },
      editingStyle: "cinematic",
      musicPreference: "upbeat electronic",
      voiceStyle: "confident narrator",
      animationStyle: "fadeWord",
      cameraMovementPreference: "dollyIn",
      fontFamily: "Geist Sans"
    };
  }

  public getBrandMemory(): BrandMemory {
    if (!this.memory) {
      this.loadMemory();
    }
    return this.memory!;
  }

  /**
   * Appends newly discovered high-performing items (hooks, titles, guidelines) directly into Brand Memory.
   */
  public updateMemory(category: string, newEntries: string[]): void {
    if (!this.memory) return;

    console.log(`[Brand Memory Engine] Appending learned insights to category "${category}":`, newEntries);

    if (category === "hooks") {
      this.memory.writingStyle.preferredHooks.push(...newEntries);
    } else if (category === "ctas") {
      this.memory.writingStyle.preferredCTAs.push(...newEntries);
    } else if (category === "guidelines") {
      this.memory.writingStyle.generalStyleGuidelines.push(...newEntries);
    }
  }
}
