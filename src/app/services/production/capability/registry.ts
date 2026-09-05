/**
 * Capability registry — register / resolve / list profiles and effective capabilities.
 * Knowledge/contract layer only — does not generate media.
 */

import type { MediaCapabilityProfile, ProviderModelCandidate, ProviderHealthSnapshot } from "./types";
import { MEDIA_CAPABILITY_PROFILES, findProfiles } from "./profiles";
import { listAdapterCapabilityClaims, getAdapterClaim } from "./adapterSupport";
import { resolveEffectiveCapability } from "./effective";
import { ServiceHealthMonitor } from "../../runtime/serviceHealthMonitor";

const registry = new Map<string, MediaCapabilityProfile>();
let seeded = false;

function keyOf(providerId: string, modelId: string): string {
  return `${providerId.toLowerCase()}::${modelId}`;
}

export function ensureCapabilityRegistry(): void {
  if (seeded) return;
  for (const profile of MEDIA_CAPABILITY_PROFILES) {
    registry.set(keyOf(profile.providerId, profile.modelId), profile);
  }
  seeded = true;
}

export function resetCapabilityRegistryForTests(): void {
  registry.clear();
  seeded = false;
}

export function registerCapabilityProfile(profile: MediaCapabilityProfile): void {
  ensureCapabilityRegistry();
  registry.set(keyOf(profile.providerId, profile.modelId), profile);
}

export function getCapabilityProfile(
  providerId: string,
  modelId?: string
): MediaCapabilityProfile | undefined {
  ensureCapabilityRegistry();
  if (modelId) return registry.get(keyOf(providerId, modelId));
  const matches = listCapabilityProfiles().filter(
    (p) => p.providerId.toLowerCase() === providerId.toLowerCase()
  );
  return matches[0];
}

export function listCapabilityProfiles(): MediaCapabilityProfile[] {
  ensureCapabilityRegistry();
  return Array.from(registry.values());
}

export function resolveHealthSnapshot(providerId: string): ProviderHealthSnapshot {
  const metrics = ServiceHealthMonitor.getInstance().getMetrics(providerId);
  const status =
    metrics.status === "healthy"
      ? "healthy"
      : metrics.status === "degraded"
        ? "degraded"
        : metrics.status === "disabled"
          ? "disabled"
          : metrics.status === "error"
            ? "error"
            : "unknown";
  return {
    providerId,
    status,
    latencyMs: metrics.latencyMs,
    errorRate: metrics.errorRate,
    lastCheck: metrics.lastCheck,
  };
}

/**
 * Build candidates with effective capabilities (provider ∩ adapter).
 */
export function listProviderModelCandidates(options?: {
  providerIds?: string[];
  requireAdapter?: boolean;
}): ProviderModelCandidate[] {
  ensureCapabilityRegistry();
  const claims = listAdapterCapabilityClaims();
  const out: ProviderModelCandidate[] = [];

  for (const profile of listCapabilityProfiles()) {
    if (options?.providerIds?.length && !options.providerIds.includes(profile.providerId)) {
      continue;
    }
    const claim = getAdapterClaim(profile.providerId, claims) || null;
    const { effective, conflicts } = resolveEffectiveCapability(profile, claim);
    if (options?.requireAdapter && !effective.adapterSupported) continue;

    out.push({
      providerId: profile.providerId,
      modelId: profile.modelId,
      version: profile.version,
      profile,
      effective,
      health: resolveHealthSnapshot(profile.providerId),
      performance: { known: false },
      economics: profile.economics,
      // stash conflicts on metadata via effective.metadata
    });

    if (conflicts.length) {
      effective.metadata = {
        ...(effective.metadata || {}),
        notes: [effective.metadata?.notes, ...conflicts.map((c) => c.detail)]
          .filter(Boolean)
          .join(" | "),
      };
    }
  }

  return out;
}

export { findProfiles };
