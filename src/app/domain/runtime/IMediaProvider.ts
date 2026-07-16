import { ProviderHealthStatus } from "./IProviderAdapter";

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: string;
  negativePrompt?: string;
  model?: string;
  quality?: "standard" | "hd";
  numImages?: number;
}

export interface ImageGenerationResponse {
  images: { url: string; b64Data?: string }[];
  metrics: {
    latencyMs: number;
    costUsd: number;
  };
}

export interface IImageProviderAdapter {
  readonly providerName: string;
  readonly supportedModels: string[];
  generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse>;
  health(): ProviderHealthStatus;
}

export interface VideoGenerationRequest {
  prompt: string;
  imageUrl?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  model?: string;
  quality?: "standard" | "high";
}

export interface VideoGenerationResponse {
  videoUrl: string;
  metrics: {
    latencyMs: number;
    costUsd: number;
  };
}

export interface IVideoProviderAdapter {
  readonly providerName: string;
  readonly supportedModels: string[];
  generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse>;
  health(): ProviderHealthStatus;
}
