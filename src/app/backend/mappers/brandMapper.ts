import type { BrandRow, Json } from "../database.types";
import type { AutomationMode, Brand } from "../../domain/types";

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asPillars(value: Json | null | undefined): Brand["contentPillars"] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const row = item as Record<string, unknown>;
      return {
        label: String(row.label ?? "Pillar"),
        active: Boolean(row.active ?? true),
      };
    }
    return { label: String(item), active: true };
  });
}

function asTones(value: Json | null | undefined): Brand["tone"] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const row = item as Record<string, unknown>;
      return {
        label: String(row.label ?? "Tone"),
        active: Boolean(row.active ?? true),
      };
    }
    return { label: String(item), active: true };
  });
}

function asAudience(value: Json | null | undefined): Brand["audience"] {
  const row = asRecord(value);
  const pain = Array.isArray(row.painPoints) ? row.painPoints.map(String) : [];
  const desires = Array.isArray(row.desires) ? row.desires.map(String) : [];
  return {
    primary: String(row.primary ?? ""),
    painPoints: pain,
    desires,
  };
}

/** Map Supabase brand row → SPARK domain brand (UI). */
export function brandRowToDomain(row: BrandRow): Brand {
  return {
    name: row.name,
    niche: row.niche ?? "",
    archetype: row.archetype ?? "",
    purpose: row.purpose ?? "",
    contentPillars: asPillars(row.content_pillars),
    audience: asAudience(row.audience),
    tone: asTones(row.tone),
    automation_mode: row.automation_mode,
    review_required: row.review_required,
    publish_requires_approval: row.publish_requires_approval,
    autonomous_publishing_enabled: row.autonomous_publishing_enabled,
  };
}

/** Map domain brand → partial BrandRow patch for update/insert. */
export function domainBrandToRowPatch(
  brand: Brand,
  automationMode: AutomationMode,
): Partial<BrandRow> {
  return {
    name: brand.name,
    niche: brand.niche || null,
    archetype: brand.archetype || null,
    purpose: brand.purpose || null,
    audience: brand.audience as unknown as Json,
    tone: brand.tone as unknown as Json,
    content_pillars: brand.contentPillars as unknown as Json,
    automation_mode: automationMode,
    review_required: brand.review_required ?? true,
    publish_requires_approval: brand.publish_requires_approval ?? true,
    autonomous_publishing_enabled: brand.autonomous_publishing_enabled ?? false,
  };
}
