/**
 * SPARK Brand Identity Constants & Options
 * Source of truth for selects, searchable pickers, tones, styles, and audience defaults.
 */

import { proposeAudienceProfile } from "../services/brand/proposeBrandBible";

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
 * Seed a short audience line if Edit Profile opens on an empty field.
 * Not a persona novel. Pain/desires stay empty unless the user writes them.
 */
export function seedDefaultAudience(params: {
  niche?: string;
  archetype?: string;
  country?: string;
  language?: string;
  characterName?: string;
}) {
  return {
    primary: proposeAudienceProfile({
      niche: params.niche,
      archetype: params.archetype,
      country: params.country,
      language: params.language,
    }),
    painPoints: [] as string[],
    desires: [] as string[],
  };
}
