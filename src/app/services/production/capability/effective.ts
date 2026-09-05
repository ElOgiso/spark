/**
 * Effective capability = provider profile ∩ adapter claim ∩ config.
 * Conflicts are surfaced; resolution is always conservative.
 */

import type { MediaCapabilityProfile, CapabilityMismatch } from "./types";
import { getAdapterClaim, type AdapterCapabilityClaim } from "./adapterSupport";
import { andBool, minControlLevel, provenance } from "./provenance";

export interface EffectiveCapabilityResult {
  effective: MediaCapabilityProfile;
  conflicts: CapabilityMismatch[];
  adapterPresent: boolean;
}

export function resolveEffectiveCapability(
  profile: MediaCapabilityProfile,
  adapterClaim?: AdapterCapabilityClaim | null
): EffectiveCapabilityResult {
  const claim = adapterClaim === undefined ? getAdapterClaim(profile.providerId) : adapterClaim;
  const conflicts: CapabilityMismatch[] = [];

  if (!claim) {
    // No adapter → SPARK cannot execute, even if provider docs claim support
    const effective: MediaCapabilityProfile = {
      ...profile,
      adapterSupported: false,
      generationModes: [],
      temporal: {
        ...profile.temporal,
        supportsStartFrame: false,
        supportsEndFrame: false,
        supportsStartAndEndFrame: false,
        supportsTailFrame: false,
        supportsPreviousShotFrame: false,
        supportsVideoContinuation: false,
        supportsVideoExtension: false,
        supportsPreviousVideoAsInput: false,
        supportsLastFrameContinuation: false,
        provenance: provenance(
          "adapter",
          "verified",
          "No SPARK adapter registered — effective temporal capabilities disabled"
        ),
      },
      references: {
        ...profile.references,
        supportedTypes: [],
        supportsMultipleReferences: false,
        maxReferences: 0,
        provenance: provenance("adapter", "verified", "No adapter — references not executable"),
      },
      metadata: {
        ...(profile.metadata || {}),
        notes: [profile.metadata?.notes, "effective:no_adapter"].filter(Boolean).join("; "),
      },
    };
    if (
      profile.adapterSupported ||
      profile.generationModes.length > 0 ||
      profile.temporal.supportsStartFrame ||
      profile.temporal.supportsEndFrame
    ) {
      conflicts.push({
        code: "CAPABILITY_CONFLICT",
        requirement: "adapter",
        detail: `Provider ${profile.providerId} has profile facts but no SPARK adapter`,
        hard: true,
      });
    }
    return { effective, conflicts, adapterPresent: false };
  }

  // Adapter present — intersect
  if (profile.temporal.supportsEndFrame && !claim.supportsEndFrame) {
    conflicts.push({
      code: "CAPABILITY_CONFLICT",
      requirement: "endFrame",
      detail: `${profile.providerId} profile claims end frame; adapter does not expose it`,
      hard: true,
    });
  }
  if (profile.temporal.supportsStartFrame && !claim.supportsStartFrame) {
    conflicts.push({
      code: "CAPABILITY_CONFLICT",
      requirement: "startFrame",
      detail: `${profile.providerId} profile claims start frame; adapter does not expose it`,
      hard: true,
    });
  }

  const supportsStartFrame = andBool(profile.temporal.supportsStartFrame, claim.supportsStartFrame);
  const supportsEndFrame = andBool(profile.temporal.supportsEndFrame, claim.supportsEndFrame);
  const modes = profile.generationModes.filter((m) => claim.generationModes.includes(m));

  const maxReferences =
    profile.references.maxReferences != null && claim.maxReferences != null
      ? Math.min(profile.references.maxReferences, claim.maxReferences)
      : claim.maxReferences ?? profile.references.maxReferences;

  const effective: MediaCapabilityProfile = {
    ...profile,
    adapterSupported: true,
    generationModes: modes,
    temporal: {
      ...profile.temporal,
      supportsStartFrame,
      supportsEndFrame,
      supportsStartAndEndFrame: supportsStartFrame && supportsEndFrame,
      supportsTailFrame: andBool(profile.temporal.supportsTailFrame, claim.supportsEndFrame),
      supportsVideoContinuation: andBool(
        profile.temporal.supportsVideoContinuation,
        claim.capabilities.some((c) => /continuation|extend/i.test(c))
      ),
      supportsVideoExtension: andBool(
        profile.temporal.supportsVideoExtension,
        claim.capabilities.some((c) => /extension|extend/i.test(c))
      ),
      supportsPreviousVideoAsInput: false, // no SPARK adapter claims this yet
      supportsLastFrameContinuation: andBool(
        profile.temporal.supportsLastFrameContinuation,
        claim.supportsEndFrame || claim.supportsStartFrame
      ),
      provenance: provenance(
        "adapter",
        "verified",
        "Effective temporal = provider ∩ adapter"
      ),
    },
    references: {
      ...profile.references,
      supportsMultipleReferences: andBool(
        profile.references.supportsMultipleReferences,
        claim.supportsMultiReference
      ),
      maxReferences,
      supportedTypes: profile.references.supportedTypes.filter((t) => {
        if (t === "image") return true;
        return claim.supportsMultiReference || claim.supportsStartFrame;
      }),
      provenance: provenance("adapter", "verified", "Effective references = provider ∩ adapter"),
    },
    camera: {
      ...profile.camera,
      controlLevel: minControlLevel(profile.camera.controlLevel, "prompt_only"),
    },
    motion: {
      ...profile.motion,
      controlLevel: minControlLevel(profile.motion.controlLevel, "prompt_only"),
    },
  };

  return { effective, conflicts, adapterPresent: true };
}
