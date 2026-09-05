/**
 * Provenance helpers and conservative defaults for capability facts.
 */

import type { CapabilityProvenance, CapabilityConfidence, CapabilityProvenanceSource } from "./types";

export function provenance(
  source: CapabilityProvenanceSource,
  confidence: CapabilityConfidence,
  notes?: string,
  verifiedAt?: string
): CapabilityProvenance {
  return {
    source,
    confidence,
    notes,
    verifiedAt,
    staleAfterDays: source === "manual_verification" || source === "adapter" ? 180 : 90,
  };
}

export function isStale(p: CapabilityProvenance, now = Date.now()): boolean {
  if (!p.verifiedAt || !p.staleAfterDays) return false;
  const verified = Date.parse(p.verifiedAt);
  if (Number.isNaN(verified)) return false;
  return now - verified > p.staleAfterDays * 24 * 60 * 60 * 1000;
}

/** Prefer the more conservative of two boolean claims. */
export function andBool(a: boolean, b: boolean): boolean {
  return a && b;
}

export function minControlLevel<T extends "none" | "prompt_only" | "structured">(
  a: T,
  b: T
): T {
  const order = { none: 0, prompt_only: 1, structured: 2 } as const;
  return order[a] <= order[b] ? a : b;
}
