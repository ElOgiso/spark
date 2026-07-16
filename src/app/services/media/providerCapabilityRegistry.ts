// ── Provider Capability Registry ──────────────────────────────────────
// Decouples specific AI provider implementations from core logic.
// Singleton – obtain via ProviderCapabilityRegistry.getInstance().

export interface ProviderCapabilities {
  supportsImage: boolean;
  supportsVideo: boolean;
  supportsImageToVideo: boolean;
  supportsCharacterTraining: boolean;
  supportsVideoAnalysis: boolean;
  supportsPromptExtraction: boolean;
  supportsProductVideos: boolean;
  supportsHookAnalysis: boolean;
  supportsEditing: boolean;
  supportsVoice: boolean;
  supportsRealtime: boolean;
  supportsUpscaling: boolean;
  supportsLipSync: boolean;
  supportsAvatar: boolean;
  supportsImageEditing: boolean;
  supportsVideoEditing: boolean;
  supportsAudioGeneration: boolean;
  supportsMusicGeneration: boolean;
  supportsSpeech: boolean;
  supportsTranscription: boolean;
  supportsCaptioning: boolean;
  supportsTranslation: boolean;
  supportsSceneDetection: boolean;
  supportsOCR: boolean;
  supportsObjectTracking: boolean;
  supportsFaceConsistency: boolean;
  supportsMultiCharacter: boolean;
  supportsLongVideo: boolean;
  supportsStreaming: boolean;
}

export class ProviderCapabilityRegistry {
  private static instance: ProviderCapabilityRegistry;
  private registry: Map<string, ProviderCapabilities> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ProviderCapabilityRegistry {
    if (!ProviderCapabilityRegistry.instance) {
      ProviderCapabilityRegistry.instance = new ProviderCapabilityRegistry();
    }
    return ProviderCapabilityRegistry.instance;
  }

  private registerDefaults(): void {
    // OpenAI capabilities
    this.registry.set('openai', {
      supportsImage: true,
      supportsVideo: false,
      supportsImageToVideo: false,
      supportsCharacterTraining: false,
      supportsVideoAnalysis: true,
      supportsPromptExtraction: true,
      supportsProductVideos: false,
      supportsHookAnalysis: true,
      supportsEditing: false,
      supportsVoice: true,
      supportsRealtime: true,
      supportsUpscaling: false,
      supportsLipSync: false,
      supportsAvatar: false,
      supportsImageEditing: true,
      supportsVideoEditing: false,
      supportsAudioGeneration: true,
      supportsMusicGeneration: false,
      supportsSpeech: true,
      supportsTranscription: true,
      supportsCaptioning: true,
      supportsTranslation: true,
      supportsSceneDetection: false,
      supportsOCR: true,
      supportsObjectTracking: false,
      supportsFaceConsistency: false,
      supportsMultiCharacter: false,
      supportsLongVideo: false,
      supportsStreaming: true,
    });

    // fal/flux capabilities
    this.registry.set('flux', {
      supportsImage: true,
      supportsVideo: false,
      supportsImageToVideo: false,
      supportsCharacterTraining: true,
      supportsVideoAnalysis: false,
      supportsPromptExtraction: false,
      supportsProductVideos: false,
      supportsHookAnalysis: false,
      supportsEditing: false,
      supportsVoice: false,
      supportsRealtime: false,
      supportsUpscaling: true,
      supportsLipSync: false,
      supportsAvatar: false,
      supportsImageEditing: true,
      supportsVideoEditing: false,
      supportsAudioGeneration: false,
      supportsMusicGeneration: false,
      supportsSpeech: false,
      supportsTranscription: false,
      supportsCaptioning: false,
      supportsTranslation: false,
      supportsSceneDetection: false,
      supportsOCR: false,
      supportsObjectTracking: false,
      supportsFaceConsistency: true,
      supportsMultiCharacter: false,
      supportsLongVideo: false,
      supportsStreaming: false,
    });

    // Google capabilities
    this.registry.set('google', {
      supportsImage: true,
      supportsVideo: true,
      supportsImageToVideo: true,
      supportsCharacterTraining: true,
      supportsVideoAnalysis: true,
      supportsPromptExtraction: true,
      supportsProductVideos: true,
      supportsHookAnalysis: true,
      supportsEditing: true,
      supportsVoice: true,
      supportsRealtime: true,
      supportsUpscaling: true,
      supportsLipSync: true,
      supportsAvatar: true,
      supportsImageEditing: true,
      supportsVideoEditing: true,
      supportsAudioGeneration: true,
      supportsMusicGeneration: true,
      supportsSpeech: true,
      supportsTranscription: true,
      supportsCaptioning: true,
      supportsTranslation: true,
      supportsSceneDetection: true,
      supportsOCR: true,
      supportsObjectTracking: true,
      supportsFaceConsistency: true,
      supportsMultiCharacter: true,
      supportsLongVideo: true,
      supportsStreaming: true,
    });
  }

  public getCapabilities(provider: string): ProviderCapabilities | undefined {
    return this.registry.get(provider.toLowerCase());
  }

  public getProvidersWithCapability(cap: keyof ProviderCapabilities): string[] {
    const list: string[] = [];
    for (const [provider, caps] of this.registry.entries()) {
      if (caps[cap] === true) {
        list.push(provider);
      }
    }
    return list;
  }
}
