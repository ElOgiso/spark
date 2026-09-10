/**
 * SPARK Native System Capability Registry
 *
 * Machine-readable declaration of SPARK's internal media production capabilities,
 * what inputs they require, what outputs they produce, and which AI providers they orchestrate.
 */

export interface SparkSystemCapability {
  id: string;
  name: string;
  category: "planning" | "generation" | "continuity" | "post_production" | "intelligence" | "publishing";
  description: string;
  orchestratesProviders: string[];
  inputRequirements: string[];
  outputArtifacts: string[];
  supportedProductionModes: ("standard" | "deep" | "express")[];
  supportsSerializedContinuity: boolean;
  status: "active" | "experimental" | "planned";
}

export const SPARK_SYSTEM_CAPABILITIES: SparkSystemCapability[] = [
  {
    id: "script_and_narrative_planning",
    name: "Script & Narrative Planning",
    category: "planning",
    description: "Multi-beat narrative structure, hook engineering, and physical action vs spoken audio separation.",
    orchestratesProviders: ["gemini", "openai", "claude"],
    inputRequirements: ["idea_or_brief", "brand_pillars", "tone", "target_duration"],
    outputArtifacts: ["ProductionBrief", "DirectorSceneScript", "Beats"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "character_sheet_generation",
    name: "Character Reference Sheet Studio",
    category: "continuity",
    description: "Generates multi-view, expression, and wardrobe reference sheets for strict character identity locks.",
    orchestratesProviders: ["gemini", "fal-flux"],
    inputRequirements: ["character_concept", "traits", "style", "aspect_ratio"],
    outputArtifacts: ["character_reference_sheet_url", "avatar_url"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "location_plate_generation",
    name: "Location Plate & Set Studio",
    category: "continuity",
    description: "Establishes architectural set references and world aesthetic plates for environmental continuity.",
    orchestratesProviders: ["gemini", "fal-flux"],
    inputRequirements: ["visual_direction", "architectural_notes", "lighting_mood"],
    outputArtifacts: ["location_plate_url"],
    supportedProductionModes: ["standard", "deep"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "storyboard_grid_and_panel_extraction",
    name: "Storyboard Grid Generation & Panel Extraction",
    category: "generation",
    description: "Synthesizes multi-panel visual storyboards and programmatically extracts high-resolution scene crops.",
    orchestratesProviders: ["gemini", "fal-flux"],
    inputRequirements: ["storyboard_scenes", "identity_pack", "visual_genre"],
    outputArtifacts: ["storyboard_grid_url", "cropped_panel_first_frames"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "image_to_video_generation",
    name: "Per-Shot Image-to-Video Engine",
    category: "generation",
    description: "Animates keyframe panels into cinematic video clips using provider-aware adapter contracts.",
    orchestratesProviders: ["grok", "kling", "seedance", "gemini", "runway", "luma"],
    inputRequirements: ["first_frame_url", "motion_prompt", "target_duration_sec", "aspect_ratio"],
    outputArtifacts: ["scene_video_clip_url", "last_frame_data_url"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "voiceover_and_tts",
    name: "Voiceover Synthesis & Dialogue Audio",
    category: "generation",
    description: "Synthesizes natural spoken dialogue or voiceover narration aligned with character voice profiles.",
    orchestratesProviders: ["elevenlabs", "gemini", "openai"],
    inputRequirements: ["spoken_script", "voice_id_or_profile", "language", "pacing"],
    outputArtifacts: ["voiceover_audio_url"],
    supportedProductionModes: ["standard", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "audio_track_mixing",
    name: "Audio Track & Ambience Mixing",
    category: "post_production",
    description: "Mixes spoken performance, background soundtrack, and diegetic foley into a cohesive soundscape.",
    orchestratesProviders: ["gemini"],
    inputRequirements: ["voiceover_url", "diegetic_notes", "soundtrack_preference"],
    outputArtifacts: ["mixed_audio_track_url"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "visual_continuity_and_reference_locking",
    name: "Visual Continuity & Reference Guard",
    category: "continuity",
    description: "Evaluates frame-to-frame identity persistence and gates generation if reference anchors drift.",
    orchestratesProviders: [],
    inputRequirements: ["first_frame_url", "identity_refs", "previous_last_frame_url"],
    outputArtifacts: ["ContinuityReport", "gated_status"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "quality_control_and_automated_repair",
    name: "Automated QC & Self-Repair Engine",
    category: "post_production",
    description: "Validates technical rendering, brand safety, and duration compliance with automated scene retries.",
    orchestratesProviders: ["grok", "kling", "seedance"],
    inputRequirements: ["rendered_video_clips", "production_spec", "brand_safety_rules"],
    outputArtifacts: ["QualityCheck", "repaired_clips"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: false,
    status: "active",
  },
  {
    id: "series_canon_and_universe_persistence",
    name: "Series Canon & Persistent Universe Engine",
    category: "intelligence",
    description: "Tracks evolving character status, world rules, established locations, and episode chronology.",
    orchestratesProviders: ["gemini", "openai"],
    inputRequirements: ["series_id", "approved_production", "story_events"],
    outputArtifacts: ["StoryCanon", "ProductionSeries", "SeriesBible"],
    supportedProductionModes: ["standard", "deep"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "multi_platform_publishing",
    name: "Multi-Platform Publishing Engine",
    category: "publishing",
    description: "Packages, resizes, and publishes completed video packages to YouTube, TikTok, Instagram, and X.",
    orchestratesProviders: [],
    inputRequirements: ["final_video_url", "thumbnail_url", "caption", "platforms"],
    outputArtifacts: ["PublishJob", "live_social_urls"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
  {
    id: "social_performance_analytics",
    name: "Social Performance & Learning Loop",
    category: "intelligence",
    description: "Monitors published views, retention, and likes, writing feedback laws into persistent Brand Memory.",
    orchestratesProviders: [],
    inputRequirements: ["published_video_ids", "platform_credentials"],
    outputArtifacts: ["BrandMemoryLaws", "PerformanceMetrics"],
    supportedProductionModes: ["standard", "deep", "express"],
    supportsSerializedContinuity: true,
    status: "active",
  },
];

/**
 * Returns the machine-readable capability for a specific SPARK capability ID.
 */
export function getSparkCapability(capabilityId: string): SparkSystemCapability | undefined {
  return SPARK_SYSTEM_CAPABILITIES.find((c) => c.id === capabilityId);
}

/**
 * Lists all active SPARK system capabilities.
 */
export function listSparkCapabilities(category?: SparkSystemCapability["category"]): SparkSystemCapability[] {
  if (category) {
    return SPARK_SYSTEM_CAPABILITIES.filter((c) => c.category === category);
  }
  return [...SPARK_SYSTEM_CAPABILITIES];
}
