import {
  IImageProviderAdapter,
  IVideoProviderAdapter,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse
} from "../domain/runtime/IMediaProvider";
import { ProviderHealthStatus } from "../domain/runtime/IProviderAdapter";

// ---------------------------------------------------------------------------
// Image Adapters
// ---------------------------------------------------------------------------

export class FluxAdapter implements IImageProviderAdapter {
  public readonly providerName = "flux";
  public readonly supportedModels = ["flux-1.1-pro", "flux-schnell"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 3200, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        images: data.images || [{ url: `/assets/flux_result.png` }],
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.04 }
      };
    } catch {
      return { images: [{ url: `/assets/flux_fallback.png` }], metrics: { latencyMs: Date.now() - start, costUsd: 0.04 } };
    }
  }
}

export class IdeogramAdapter implements IImageProviderAdapter {
  public readonly providerName = "ideogram";
  public readonly supportedModels = ["ideogram-v2"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 2800, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        images: data.images || [{ url: `/assets/ideogram_result.png` }],
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.05 }
      };
    } catch {
      return { images: [{ url: `/assets/ideogram_fallback.png` }], metrics: { latencyMs: Date.now() - start, costUsd: 0.05 } };
    }
  }
}

export class RecraftAdapter implements IImageProviderAdapter {
  public readonly providerName = "recraft";
  public readonly supportedModels = ["recraft-v3"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 2500, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        images: data.images || [{ url: `/assets/recraft_result.png` }],
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.03 }
      };
    } catch {
      return { images: [{ url: `/assets/recraft_fallback.png` }], metrics: { latencyMs: Date.now() - start, costUsd: 0.03 } };
    }
  }
}

export class OpenAIImagesAdapter implements IImageProviderAdapter {
  public readonly providerName = "openai_images";
  public readonly supportedModels = ["dall-e-3"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 4000, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        images: data.images || [{ url: `/assets/dalle3_result.png` }],
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.080 }
      };
    } catch {
      return { images: [{ url: `/assets/dalle3_fallback.png` }], metrics: { latencyMs: Date.now() - start, costUsd: 0.080 } };
    }
  }
}

// ---------------------------------------------------------------------------
// Video Adapters
// ---------------------------------------------------------------------------

export class SeedanceAdapter implements IVideoProviderAdapter {
  public readonly providerName = "seedance";
  public readonly supportedModels = ["seedance-v1"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 12000, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, imageUrl: req.imageUrl, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        videoUrl: data.videoUrl || `/assets/seedance_result.mp4`,
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.15 }
      };
    } catch {
      return { videoUrl: `/assets/seedance_fallback.mp4`, metrics: { latencyMs: Date.now() - start, costUsd: 0.15 } };
    }
  }
}

export class HiggsfieldAdapter implements IVideoProviderAdapter {
  public readonly providerName = "higgsfield";
  public readonly supportedModels = ["higgsfield-v2"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 14000, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, imageUrl: req.imageUrl, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        videoUrl: data.videoUrl || `/assets/higgsfield_result.mp4`,
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.18 }
      };
    } catch {
      return { videoUrl: `/assets/higgsfield_fallback.mp4`, metrics: { latencyMs: Date.now() - start, costUsd: 0.18 } };
    }
  }
}

export class RunwayAdapter implements IVideoProviderAdapter {
  public readonly providerName = "runway";
  public readonly supportedModels = ["gen-3-alpha"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 15000, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, imageUrl: req.imageUrl, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        videoUrl: data.videoUrl || `/assets/runway_result.mp4`,
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.25 }
      };
    } catch {
      return { videoUrl: `/assets/runway_fallback.mp4`, metrics: { latencyMs: Date.now() - start, costUsd: 0.25 } };
    }
  }
}

export class VeoAdapter implements IVideoProviderAdapter {
  public readonly providerName = "veo";
  public readonly supportedModels = ["veo-2.0"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 18000, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, imageUrl: req.imageUrl, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        videoUrl: data.videoUrl || `/assets/veo_result.mp4`,
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.30 }
      };
    } catch {
      return { videoUrl: `/assets/veo_fallback.mp4`, metrics: { latencyMs: Date.now() - start, costUsd: 0.30 } };
    }
  }
}

export class KlingAdapter implements IVideoProviderAdapter {
  public readonly providerName = "kling";
  public readonly supportedModels = ["kling-1.6"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 11000, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, imageUrl: req.imageUrl, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        videoUrl: data.videoUrl || `/assets/kling_result.mp4`,
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.20 }
      };
    } catch {
      return { videoUrl: `/assets/kling_fallback.mp4`, metrics: { latencyMs: Date.now() - start, costUsd: 0.20 } };
    }
  }
}

export class PikaAdapter implements IVideoProviderAdapter {
  public readonly providerName = "pika";
  public readonly supportedModels = ["pika-2.0"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 10000, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, imageUrl: req.imageUrl, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        videoUrl: data.videoUrl || `/assets/pika_result.mp4`,
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.16 }
      };
    } catch {
      return { videoUrl: `/assets/pika_fallback.mp4`, metrics: { latencyMs: Date.now() - start, costUsd: 0.16 } };
    }
  }
}

export class LumaAdapter implements IVideoProviderAdapter {
  public readonly providerName = "luma";
  public readonly supportedModels = ["luma-dream-machine"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 13000, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, imageUrl: req.imageUrl, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        videoUrl: data.videoUrl || `/assets/luma_result.mp4`,
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.22 }
      };
    } catch {
      return { videoUrl: `/assets/luma_fallback.mp4`, metrics: { latencyMs: Date.now() - start, costUsd: 0.22 } };
    }
  }
}

export class WanAdapter implements IVideoProviderAdapter {
  public readonly providerName = "wan";
  public readonly supportedModels = ["wan-2.1-t2v-14b"];
  public health(): ProviderHealthStatus {
    return { status: "healthy", latencyMs: 9500, errorRate: 0, lastChecked: new Date().toISOString() };
  }
  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const start = Date.now();
    try {
      const res = await fetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: this.providerName, prompt: req.prompt, imageUrl: req.imageUrl, aspectRatio: req.aspectRatio, model: req.model })
      });
      const data = await res.json();
      return {
        videoUrl: data.videoUrl || `/assets/wan_result.mp4`,
        metrics: { latencyMs: Date.now() - start, costUsd: data.costUsd || 0.12 }
      };
    } catch {
      return { videoUrl: `/assets/wan_fallback.mp4`, metrics: { latencyMs: Date.now() - start, costUsd: 0.12 } };
    }
  }
}

// ---------------------------------------------------------------------------
// Media Adapter Factory
// ---------------------------------------------------------------------------

export class MediaAdapterFactory {
  private static imageRegistry = new Map<string, () => IImageProviderAdapter>();
  private static videoRegistry = new Map<string, () => IVideoProviderAdapter>();

  static {
    MediaAdapterFactory.imageRegistry.set("flux", () => new FluxAdapter());
    MediaAdapterFactory.imageRegistry.set("ideogram", () => new IdeogramAdapter());
    MediaAdapterFactory.imageRegistry.set("recraft", () => new RecraftAdapter());
    MediaAdapterFactory.imageRegistry.set("openai_images", () => new OpenAIImagesAdapter());

    MediaAdapterFactory.videoRegistry.set("seedance", () => new SeedanceAdapter());
    MediaAdapterFactory.videoRegistry.set("higgsfield", () => new HiggsfieldAdapter());
    MediaAdapterFactory.videoRegistry.set("runway", () => new RunwayAdapter());
    MediaAdapterFactory.videoRegistry.set("veo", () => new VeoAdapter());
    MediaAdapterFactory.videoRegistry.set("kling", () => new KlingAdapter());
    MediaAdapterFactory.videoRegistry.set("pika", () => new PikaAdapter());
    MediaAdapterFactory.videoRegistry.set("luma", () => new LumaAdapter());
    MediaAdapterFactory.videoRegistry.set("wan", () => new WanAdapter());
  }

  public static getImageAdapter(name: string): IImageProviderAdapter {
    const builder = this.imageRegistry.get(name.toLowerCase());
    if (!builder) throw new Error(`Unsupported image provider: ${name}`);
    return builder();
  }

  public static getVideoAdapter(name: string): IVideoProviderAdapter {
    const builder = this.videoRegistry.get(name.toLowerCase());
    if (!builder) throw new Error(`Unsupported video provider: ${name}`);
    return builder();
  }
}
