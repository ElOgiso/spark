/**
 * Reference Compiler for Provider Payload Compiler.
 *
 * Resolves references from ReferenceGraph / SemanticReference / ShotReferencePack
 * and maps them into provider-compatible media roles with strict limit enforcement
 * and priority ordering (Identity ≠ Camera Viewpoint ≠ Style).
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { ReferenceGraph } from "../specification/referenceGraph";
import type { MediaCapabilityProfile } from "../capability/types";
import type { SemanticReference } from "../specification/semanticMedia";
import type { CompiledMediaInput, ProviderMediaRole } from "./types";
import { isDirectProviderMediaUrl } from "../../../../../api/runtime/_videoContract";

export interface ReferenceCompilationResult {
  firstFrame?: string;
  lastFrame?: string;
  references: string[];
  inputs: CompiledMediaInput[];
  errors: string[];
  warnings: string[];
}

export function compileReferences(params: {
  shot: ShotSpec;
  referenceGraph?: ReferenceGraph;
  overrideReferences?: SemanticReference[];
  capabilityProfile: MediaCapabilityProfile;
}): ReferenceCompilationResult {
  const { shot, referenceGraph, overrideReferences, capabilityProfile } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  const inputs: CompiledMediaInput[] = [];
  const seenUrls = new Set<string>();

  // 1. Resolve first frame (start frame)
  let firstFrame = shot.keyframeUrl || shot.references?.firstFrameUrl;

  // 2. Resolve last frame (tail frame)
  let lastFrame = shot.lastFrameUrl || shot.references?.lastFrameUrl;

  // Check override references first if supplied
  if (overrideReferences && overrideReferences.length > 0) {
    for (const ref of overrideReferences) {
      if (!ref.url) continue;
      if (ref.role === "START_FRAME" && !firstFrame) {
        firstFrame = ref.url;
      } else if (ref.role === "END_FRAME" && !lastFrame) {
        lastFrame = ref.url;
      }
    }
  }

  // Check ReferenceGraph if available
  if (referenceGraph && referenceGraph.nodes?.length > 0) {
    for (const node of referenceGraph.nodes) {
      if (!node.url) continue;
      if (node.type === "START_FRAME" && !firstFrame) {
        firstFrame = node.url;
      } else if (node.type === "END_FRAME" && !lastFrame) {
        lastFrame = node.url;
      }
    }
  }

  if (firstFrame) {
    seenUrls.add(firstFrame);
    inputs.push({
      role: "first_frame",
      url: firstFrame,
      importance: "required",
      semanticRole: "START_FRAME",
    });
  }

  if (lastFrame && lastFrame !== firstFrame) {
    seenUrls.add(lastFrame);
    inputs.push({
      role: "last_frame",
      url: lastFrame,
      importance: "preferred",
      semanticRole: "END_FRAME",
    });
  }

  // 3. Resolve Reference Images (Identity / Character / Style / Environment)
  const candidateRefs: Array<{
    url: string;
    role: ProviderMediaRole;
    semanticRole: import("../specification/semanticMedia").SemanticReferenceRole;
    priority: number; // lower number = higher priority
    semanticNodeId?: string;
  }> = [];

  // From ReferenceGraph
  if (referenceGraph && referenceGraph.nodes) {
    for (const node of referenceGraph.nodes) {
      if (!node.url || seenUrls.has(node.url)) continue;
      if (node.type === "CHARACTER" || node.type === "CHARACTER_IDENTITY") {
        candidateRefs.push({
          url: node.url,
          role: "character_reference",
          semanticRole: "CHARACTER",
          priority: 1, // Character/Identity highest
          semanticNodeId: node.id,
        });
      } else if (node.type === "ENVIRONMENT" || node.type === "LOCATION") {
        candidateRefs.push({
          url: node.url,
          role: "reference_image",
          semanticRole: "ENVIRONMENT",
          priority: 2,
          semanticNodeId: node.id,
        });
      } else if (node.type === "STYLE") {
        candidateRefs.push({
          url: node.url,
          role: "style_reference",
          semanticRole: "STYLE",
          priority: 3,
          semanticNodeId: node.id,
        });
      }
    }
  }

  // From ShotSpec.semanticReferences
  if (shot.semanticReferences) {
    for (const sRef of shot.semanticReferences) {
      if (!sRef.url || seenUrls.has(sRef.url)) continue;
      if (sRef.role === "CHARACTER" || sRef.role === "IDENTITY") {
        candidateRefs.push({
          url: sRef.url,
          role: "character_reference",
          semanticRole: sRef.role,
          priority: 1,
        });
      } else if (sRef.role === "ENVIRONMENT" || sRef.role === "PROP") {
        candidateRefs.push({
          url: sRef.url,
          role: "reference_image",
          semanticRole: sRef.role,
          priority: 2,
        });
      } else if (sRef.role === "STYLE") {
        candidateRefs.push({
          url: sRef.url,
          role: "style_reference",
          semanticRole: sRef.role,
          priority: 3,
        });
      }
    }
  }

  // From legacy ShotReferencePack
  if (shot.references) {
    for (const url of shot.references.characterRefs || []) {
      if (url.startsWith("http") && !seenUrls.has(url)) {
        candidateRefs.push({
          url,
          role: "character_reference",
          semanticRole: "CHARACTER",
          priority: 1,
        });
      }
    }
    for (const url of shot.references.locationRefs || []) {
      if (url.startsWith("http") && !seenUrls.has(url)) {
        candidateRefs.push({
          url,
          role: "reference_image",
          semanticRole: "ENVIRONMENT",
          priority: 2,
        });
      }
    }
    for (const url of shot.references.styleRefs || []) {
      if (url.startsWith("http") && !seenUrls.has(url)) {
        candidateRefs.push({
          url,
          role: "style_reference",
          semanticRole: "STYLE",
          priority: 3,
        });
      }
    }
  }

  const sourceVideos: Array<{ url: string; semanticNodeId?: string }> = [];
  const considerSource = (url: string | undefined, semanticNodeId?: string) => {
    if (!url || seenUrls.has(url)) return;
    if (!isDirectProviderMediaUrl(url)) {
      warnings.push(
        `SOURCE_VIDEO_NOT_A_MEDIA_URL: ${url.slice(0, 48)} is not a provider video input and was not compiled onto the wire.`
      );
      return;
    }
    seenUrls.add(url);
    sourceVideos.push({ url, semanticNodeId });
  };
  if (referenceGraph?.nodes) {
    for (const node of referenceGraph.nodes) {
      if (node.type === "SOURCE_VIDEO") considerSource(node.url, node.id);
    }
  }
  if (shot.semanticReferences) {
    for (const sRef of shot.semanticReferences) {
      if (sRef.role === "SOURCE_VIDEO") considerSource(sRef.url);
    }
  }

  // Sort candidate references by priority
  candidateRefs.sort((a, b) => a.priority - b.priority);

  // Apply provider reference limits
  const maxRefs = capabilityProfile.limits.maxReferenceCount ??
    (capabilityProfile.references.maxReferences ?? (capabilityProfile.providerId === "kling" ? 4 : 7));

  const finalReferenceUrls: string[] = [];
  for (const c of candidateRefs) {
    if (seenUrls.has(c.url)) continue;
    if (finalReferenceUrls.length >= maxRefs) {
      warnings.push(`REFERENCE_LIMIT_EXCEEDED: Dropping lower priority reference ${c.url.slice(0, 30)}... (limit: ${maxRefs})`);
      continue;
    }
    seenUrls.add(c.url);
    finalReferenceUrls.push(c.url);
    inputs.push({
      role: c.role,
      url: c.url,
      semanticRole: c.semanticRole,
      semanticNodeId: c.semanticNodeId,
      importance: c.priority === 1 ? "required" : "preferred",
    });
  }

  for (const video of sourceVideos) {
    inputs.push({
      role: "source_video",
      url: video.url,
      semanticRole: "SOURCE_VIDEO",
      semanticNodeId: video.semanticNodeId,
      importance: "preferred",
    });
  }

  return {
    firstFrame,
    lastFrame,
    references: finalReferenceUrls,
    inputs,
    errors,
    warnings,
  };
}
