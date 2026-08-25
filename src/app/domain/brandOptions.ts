/**
 * SPARK Brand Identity Constants & Options
 * Source of truth for selects, searchable pickers, tones, styles, and audience defaults.
 */

export const BRAND_ARCHETYPES = [
  "Visionary Creator",
  "Educator",
  "Entertainer",
  "Operator",
  "Analyst",
  "Mentor",
  "Provocateur",
  "Builder",
  "Storyteller",
  "Strategist",
  "Industry Insider",
] as const;

export const BRAND_NICHES = [
  "AI & Automation",
  "Tech & Software",
  "Finance & Wealth",
  "Business & Startups",
  "Marketing & Growth",
  "Creator Economy",
  "Health & Longevity",
  "E-Commerce",
  "Productivity & Systems",
  "Crypto & Web3",
  "Real Estate",
  "Education & EdTech",
  "Design & Creative",
  "Lifestyle & Media",
] as const;

export const BRAND_COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Nigeria",
  "Germany",
  "France",
  "India",
  "Singapore",
  "United Arab Emirates",
  "South Africa",
  "Kenya",
  "Ghana",
  "Brazil",
  "Japan",
  "South Korea",
  "Netherlands",
  "Spain",
  "Italy",
  "Mexico",
  "Indonesia",
  "Philippines",
  "Ireland",
  "New Zealand",
  "Sweden",
  "Switzerland",
  "Norway",
  "Denmark",
  "Poland",
  "Israel",
  "Saudi Arabia",
  "Egypt",
  "Argentina",
  "Colombia",
  "Chile",
  "Malaysia",
  "Thailand",
  "Vietnam",
  "Pakistan",
  "Bangladesh",
  "Global / Remote",
] as const;

export const BRAND_LANGUAGES = [
  "English (US)",
  "English (UK)",
  "English (Global)",
  "English (AU)",
  "English (NG)",
  "English (IN)",
  "Spanish (Latin America)",
  "Spanish (Spain)",
  "French (France)",
  "French (Canada)",
  "German",
  "Portuguese (Brazil)",
  "Portuguese (Portugal)",
  "Italian",
  "Hindi",
  "Japanese",
  "Korean",
  "Mandarin Chinese",
  "Arabic",
  "Dutch",
  "Russian",
  "Turkish",
  "Indonesian",
  "Vietnamese",
  "Polish",
  "Swedish",
] as const;

export const BRAND_TONE_OPTIONS = [
  "Authoritative",
  "Educational",
  "Conversational",
  "Witty",
  "Bold",
  "Calm",
  "Empathetic",
  "Urgent",
  "Playful",
  "Professional",
  "Street-smart",
  "Inspirational",
  "Analytical",
  "No-fluff",
] as const;

export const BRAND_STYLE_OPTIONS = [
  "Direct-to-camera",
  "Story-driven",
  "Framework/list",
  "Myth-bust",
  "Case study",
  "Hot take",
  "Tutorial",
  "Documentary",
] as const;

/**
 * Seed sensible default audience profile if fields are empty after onboard
 */
export function seedDefaultAudience(params: {
  niche?: string;
  archetype?: string;
  country?: string;
  characterName?: string;
}) {
  const nicheLabel = params.niche || "digital business & creation";
  return {
    primary: `Ambitious operators, creators, and professionals in ${nicheLabel}`,
    painPoints: [
      `Inconsistent publishing cadence and fragmented research`,
      `Low viewer retention and high production friction`,
      `Difficulty translating deep expertise into high-performing short & long-form video`,
    ],
    desires: [
      `Build undeniable category authority in ${nicheLabel}`,
      `Scale high-retention video output with predictable compounding growth`,
      `Monetize audience trust through high-ticket offers and consistent distribution`,
    ],
  };
}
