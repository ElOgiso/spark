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
  if (!value) return [];
  if (Array.isArray(value)) {
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
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.tones)) {
      return asTones(obj.tones as Json);
    }
  }
  return [];
}

function asStyles(value: Json | null | undefined): Brand["style"] {
  if (!value) return [];
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.style)) {
      return (obj.style as any[]).map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const row = item as Record<string, unknown>;
          return {
            label: String(row.label ?? "Style"),
            active: Boolean(row.active ?? true),
          };
        }
        return { label: String(item), active: true };
      });
    }
  }
  return [];
}

function asAudience(value: Json | null | undefined): Brand["audience"] & { country?: string; language?: string; website?: string } {
  const row = asRecord(value);
  const pain = Array.isArray(row.painPoints) ? row.painPoints.map(String) : [];
  const desires = Array.isArray(row.desires) ? row.desires.map(String) : [];
  return {
    primary: String(row.primary ?? ""),
    painPoints: pain,
    desires,
    country: typeof row.country === "string" ? row.country : undefined,
    language: typeof row.language === "string" ? row.language : undefined,
    website: typeof row.website === "string" ? row.website : undefined,
  };
}

/** Map Supabase brand row → SPARK domain brand (UI). */
export function brandRowToDomain(row: BrandRow): Brand {
  const aud = asAudience(row.audience);
  return {
    name: row.name,
    niche: row.niche ?? "",
    archetype: row.archetype ?? "",
    purpose: row.purpose ?? "",
    country: (row as any).country || aud.country || "United States",
    language: (row as any).language || aud.language || "English (US)",
    website: (row as any).website || aud.website || "",
    contentPillars: asPillars(row.content_pillars),
    audience: {
      primary: aud.primary,
      painPoints: aud.painPoints,
      desires: aud.desires,
    },
    tone: asTones(row.tone),
    style: asStyles(row.tone),
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
  const audienceObj: Record<string, any> = {
    ...(brand.audience || {}),
  };
  if (brand.country) audienceObj.country = brand.country;
  if (brand.language) audienceObj.language = brand.language;
  if (brand.website) audienceObj.website = brand.website;

  const toneJson = brand.style && brand.style.length > 0
    ? {
        tones: brand.tone,
        style: brand.style,
      }
    : brand.tone;

  return {
    name: brand.name,
    niche: brand.niche || null,
    archetype: brand.archetype || null,
    purpose: brand.purpose || null,
    audience: audienceObj as unknown as Json,
    tone: toneJson as unknown as Json,
    content_pillars: brand.contentPillars as unknown as Json,
    automation_mode: automationMode,
    review_required: brand.review_required ?? true,
    publish_requires_approval: brand.publish_requires_approval ?? true,
    autonomous_publishing_enabled: brand.autonomous_publishing_enabled ?? false,
  };
}
