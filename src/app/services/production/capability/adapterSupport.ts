/**
 * Adapter capability claims — what SPARK can actually send today.
 * Intersection with provider profiles yields effective capability.
 */

import type { MediaCapabilityProfile, ReferenceType } from "./types";
import { provenance } from "./provenance";
import {
  createDefaultAdapterRegistry,
  listRegisteredAdapterCapabilities,
} from "../execution/adapters/registry";

export interface AdapterCapabilityClaim {
  providerId: string;
  mediaTypes: Array<"image" | "video" | "audio" | "merge">;
  strategies: string[];
  capabilities: string[];
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsMultiReference: boolean;
  maxReferences?: number;
  generationModes: MediaCapabilityProfile["generationModes"];
}

const KNOWN_ADAPTER_OVERRIDES: Record<string, Partial<AdapterCapabilityClaim>> = {
  kling: {
    supportsStartFrame: true,
    supportsEndFrame: true,
    supportsMultiReference: false,
    maxReferences: 1,
    generationModes: ["image_to_video"],
  },
  seedance: {
    supportsStartFrame: true,
    supportsEndFrame: true,
    supportsMultiReference: true,
    maxReferences: 4,
    generationModes: ["image_to_video"],
  },
  grok: {
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsMultiReference: true,
    maxReferences: 7,
    generationModes: ["image_to_video"],
  },
  gemini: {
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsMultiReference: false,
    maxReferences: 1,
    generationModes: ["image_to_video", "text_to_video"],
  },
  openai: {
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsMultiReference: true,
    maxReferences: 4,
    generationModes: ["text_to_image", "image_to_image"],
  },
  elevenlabs: {
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsMultiReference: false,
    generationModes: ["text_to_speech"],
  },
};

function modesFromStrategies(strategies: string[]): MediaCapabilityProfile["generationModes"] {
  const modes: MediaCapabilityProfile["generationModes"] = [];
  for (const s of strategies) {
    if (s.includes("image_to_video") || s === "i2v") modes.push("image_to_video");
    if (s.includes("text_to_video") || s === "t2v") modes.push("text_to_video");
    if (s.includes("text_to_image")) modes.push("text_to_image");
    if (s.includes("image_to_image")) modes.push("image_to_image");
  }
  return Array.from(new Set(modes));
}

/**
 * Discover adapter claims from the default registry (+ explicit overrides).
 * Providers without a registered adapter are absent from this list.
 */
export function listAdapterCapabilityClaims(
  registry = createDefaultAdapterRegistry()
): AdapterCapabilityClaim[] {
  const snaps = listRegisteredAdapterCapabilities(registry);
  const byProvider = new Map<string, AdapterCapabilityClaim>();

  for (const snap of snaps) {
    const id = snap.providerId.toLowerCase();
    const override = KNOWN_ADAPTER_OVERRIDES[id] || {};
    const caps = snap.capabilities || [];
    const claim: AdapterCapabilityClaim = {
      providerId: id,
      mediaTypes: snap.mediaTypes,
      strategies: snap.strategies,
      capabilities: caps,
      supportsStartFrame:
        override.supportsStartFrame ??
        caps.some((c) => /first_frame|start_frame/i.test(c)),
      supportsEndFrame:
        override.supportsEndFrame ??
        caps.some((c) => /last_frame|end_frame|tail/i.test(c)),
      supportsMultiReference:
        override.supportsMultiReference ??
        (/multi_reference|first_last_frame/.test(snap.strategies.join(" ")) ||
          caps.some((c) => /multi_reference/i.test(c))),
      maxReferences: override.maxReferences,
      generationModes: override.generationModes ?? modesFromStrategies(snap.strategies),
    };
    const prev = byProvider.get(id);
    if (!prev) {
      byProvider.set(id, claim);
    } else {
      byProvider.set(id, {
        ...prev,
        mediaTypes: Array.from(new Set([...prev.mediaTypes, ...claim.mediaTypes])),
        strategies: Array.from(new Set([...prev.strategies, ...claim.strategies])),
        capabilities: Array.from(new Set([...prev.capabilities, ...claim.capabilities])),
        supportsStartFrame: prev.supportsStartFrame || claim.supportsStartFrame,
        supportsEndFrame: prev.supportsEndFrame || claim.supportsEndFrame,
        supportsMultiReference: prev.supportsMultiReference || claim.supportsMultiReference,
        maxReferences:
          prev.maxReferences != null && claim.maxReferences != null
            ? Math.max(prev.maxReferences, claim.maxReferences)
            : prev.maxReferences ?? claim.maxReferences,
        generationModes: Array.from(new Set([...prev.generationModes, ...claim.generationModes])),
      });
    }
  }

  return Array.from(byProvider.values());
}

export function getAdapterClaim(
  providerId: string,
  claims = listAdapterCapabilityClaims()
): AdapterCapabilityClaim | undefined {
  return claims.find((c) => c.providerId === providerId.toLowerCase());
}

export function adapterReferenceTypes(claim: AdapterCapabilityClaim): ReferenceType[] {
  const types: ReferenceType[] = [];
  if (claim.supportsStartFrame || claim.capabilities.some((c) => /image/i.test(c))) {
    types.push("image");
  }
  if (claim.supportsMultiReference) {
    types.push("character", "face");
  }
  return types;
}

export function adapterProvenanceNote(providerId: string): string {
  const p = provenance("adapter", "verified");
  return `Adapter claim for ${providerId} @ ${p.verifiedAt || "runtime"}`;
}
