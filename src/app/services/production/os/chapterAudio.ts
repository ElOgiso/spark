import { normalizeModeString } from "../resolveProductionMode";
/**
 * SPARK Chapter Audio Authority
 * Resolves per-chapter audio routing ("vo" | "talent") according to production mode:
 * - narrator: every chapter = "vo"
 * - cinematic: every chapter = "talent" (diegetic speech; no narrator bed)
 * - hybrid: honors chapter.audio / beat.audio -> job hints (hook/payoff/cta -> talent, proof/context -> vo) -> default "vo"
 * Never maps all non-express beats to talent.
 */

export interface ResolveChapterAudioParams {
  mode?: string;
  chapter?: {
    audio?: "vo" | "talent" | string;
    job?: string;
    visualIntent?: string;
  } | null;
  beat?: {
    audio?: "vo" | "talent" | string;
    valueJob?: string;
  } | null;
}

export function normalizeAudioMode(rawMode?: string): "narrator" | "hybrid" | "cinematic" {
  const m = normalizeModeString(rawMode);
  if (m === "express") return "narrator";
  if (m === "deep") return "cinematic";
  return "hybrid";
}

export function resolveChapterAudio(params: ResolveChapterAudioParams): "vo" | "talent" {
  const mode = normalizeAudioMode(params.mode);

  // narrator: every chapter audio = "vo". Ignore talent. No I2V film.
  if (mode === "narrator") {
    return "vo";
  }

  // cinematic: every chapter audio = "talent" (diegetic / in-world). skipExternalVoice. No narrator bed.
  if (mode === "cinematic") {
    return "talent";
  }

  // hybrid:
  // 1. chapter.audio or beat.audio if vo|talent
  const directAudio = String(params.chapter?.audio || params.beat?.audio || "").toLowerCase().trim();
  if (directAudio === "vo" || directAudio === "talent") {
    return directAudio as "vo" | "talent";
  }

  // 2. else job hint: hook/payoff/cta with on-camera host -> talent; proof/context explainer -> vo
  const rawJob = String(params.chapter?.job || params.beat?.valueJob || "").toLowerCase().trim();
  if (rawJob === "hook" || rawJob === "payoff" || rawJob === "cta") {
    return "talent";
  }
  if (
    rawJob === "proof" ||
    rawJob === "context" ||
    rawJob === "problem" ||
    rawJob === "example" ||
    rawJob === "myth_bust" ||
    rawJob === "slide" ||
    rawJob === "still" ||
    rawJob === "b-roll" ||
    rawJob === "explainer"
  ) {
    return "vo";
  }

  // 3. else "vo" (Never: mode !== express -> talent)
  return "vo";
}
