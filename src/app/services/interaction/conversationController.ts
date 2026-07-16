export class ConversationController {
  private static instance: ConversationController;

  public static getInstance(): ConversationController {
    if (!ConversationController.instance) {
      ConversationController.instance = new ConversationController();
    }
    return ConversationController.instance;
  }

  public handleConversation(prompt: string): string {
    const lower = prompt.toLowerCase().trim();

    if (
      lower.includes("hello") ||
      lower.includes("hi") ||
      lower.includes("hey") ||
      lower.startsWith("yo") ||
      lower.includes("good morning") ||
      lower.includes("good afternoon") ||
      lower.includes("good evening")
    ) {
      return "Hello! I am Spark, your Media Operating System. How can I help you today?";
    }

    if (lower.includes("who are you")) {
      return "I am Spark, your AI-driven Media Operating System. I coordinate research, scriptwriting, storyboarding, and video editing workflows.";
    }

    if (lower.includes("thanks") || lower.includes("thank you")) {
      return "You're welcome! Let me know if you need to generate any scripts, storyboards, or videos.";
    }

    if (lower.includes("mcp") || lower.includes("model context protocol")) {
      return "MCP (Model Context Protocol) is an open standard that enables AI models to connect to external databases, APIs, and tools securely. Spark uses MCP to load custom server definitions dynamically.";
    }

    if (lower.includes("veo") || lower.includes("google veo")) {
      return "Veo is Google's state-of-the-art generative video model, capable of producing high-quality 1080p videos in a variety of cinematic styles. Spark integrates with Veo via the Service Registry.";
    }

    if (lower.includes("help") || lower.includes("explain")) {
      return "I am Spark, an AI-driven Media Operating System. I coordinate research, scriptwriting, storyboard generation, video editing, and analytics. You can command me to 'Create a TikTok about space travel' or 'Publish this reel' to trigger my automated agent pipeline.";
    }

    // Default conversational fallback
    return `I can help you build campaigns, write storyboards, or coordinate visual edits. Let me know what you would like to create!`;
  }
}
