/**
 * Resolve directing / spoken script for Creative Review.
 *
 * Precedence order:
 * 1. production.brief.narrativeScript.fullSpokenScript
 * 2. join production.brief.narrativeScript.chapters[].spoken (ordered)
 * 3. production.narrativeScriptObj / spark.narrativeScriptObj
 * 4. brief beats spokenLines joined
 * 5. spark.suggestedScript
 *
 * Empty state: "No spoken script on this production yet."
 * Never calls Claude again just for display.
 */

export interface ReviewScriptChapter {
  order: number;
  title: string;
  durationSec?: number;
  spoken: string;
  timecode?: string;
  visual?: string;
}

export interface ResolvedReviewScript {
  fullSpokenScript: string;
  chapters: ReviewScriptChapter[];
  source:
    | "narrativeScript.fullSpokenScript"
    | "narrativeScript.chapters"
    | "narrativeScriptObj"
    | "beats"
    | "suggestedScript"
    | "none";
  hasScript: boolean;
}

export function resolveReviewScript(params: {
  production?: any;
  brief?: any;
  review?: any;
  spark?: any;
}): ResolvedReviewScript {
  const prod = params.production || {};
  const rev = params.review || {};
  const brief = params.brief || prod.brief || rev.brief || {};
  const spark = params.spark || {};

  // 1a. brief.narrativeScript.fullSpokenScript
  const ns = brief.narrativeScript || prod.narrativeScript || rev.narrativeScript;
  if (ns && typeof ns.fullSpokenScript === "string" && ns.fullSpokenScript.trim()) {
    const chapters: ReviewScriptChapter[] = Array.isArray(ns.chapters)
      ? ns.chapters.map((c: any, i: number) => ({
          order: typeof c.order === "number" ? c.order : i + 1,
          title: c.title || `Chapter ${i + 1}`,
          durationSec: typeof c.durationSec === "number" ? c.durationSec : undefined,
          spoken: typeof c.spoken === "string" ? c.spoken : "",
          timecode: typeof c.timecode === "string" ? c.timecode : undefined,
          visual: typeof c.visual === "string" ? c.visual : undefined,
        }))
      : [];
    return {
      fullSpokenScript: ns.fullSpokenScript.trim(),
      chapters,
      source: "narrativeScript.fullSpokenScript",
      hasScript: true,
    };
  }

  // 1b. join brief.narrativeScript.chapters[].spoken (order)
  if (ns && Array.isArray(ns.chapters) && ns.chapters.length > 0) {
    const sortedChapters = [...ns.chapters].sort(
      (a: any, b: any) => (a.order || 0) - (b.order || 0)
    );
    const joined = sortedChapters
      .map((c: any) => (typeof c.spoken === "string" ? c.spoken.trim() : ""))
      .filter(Boolean)
      .join("\n\n");
    if (joined) {
      return {
        fullSpokenScript: joined,
        chapters: sortedChapters.map((c: any, i: number) => ({
          order: typeof c.order === "number" ? c.order : i + 1,
          title: c.title || `Chapter ${i + 1}`,
          durationSec: typeof c.durationSec === "number" ? c.durationSec : undefined,
          spoken: typeof c.spoken === "string" ? c.spoken : "",
          timecode: typeof c.timecode === "string" ? c.timecode : undefined,
          visual: typeof c.visual === "string" ? c.visual : undefined,
        })),
        source: "narrativeScript.chapters",
        hasScript: true,
      };
    }
  }

  // 1c. production.narrativeScriptObj / spark.narrativeScriptObj
  const nsObj =
    prod.narrativeScriptObj ||
    spark.narrativeScriptObj ||
    rev.narrativeScriptObj ||
    prod.narrativeScript ||
    brief.narrativeScriptObj;
  if (nsObj) {
    if (typeof nsObj.fullSpokenScript === "string" && nsObj.fullSpokenScript.trim()) {
      const chapters: ReviewScriptChapter[] = Array.isArray(nsObj.chapters)
        ? nsObj.chapters.map((c: any, i: number) => ({
            order: typeof c.order === "number" ? c.order : i + 1,
            title: c.title || `Chapter ${i + 1}`,
            durationSec: typeof c.durationSec === "number" ? c.durationSec : undefined,
            spoken: typeof c.spoken === "string" ? c.spoken : "",
          timecode: typeof c.timecode === "string" ? c.timecode : undefined,
          visual: typeof c.visual === "string" ? c.visual : undefined,
          }))
        : [];
      return {
        fullSpokenScript: nsObj.fullSpokenScript.trim(),
        chapters,
        source: "narrativeScriptObj",
        hasScript: true,
      };
    }
    if (Array.isArray(nsObj.chapters) && nsObj.chapters.length > 0) {
      const sortedChapters = [...nsObj.chapters].sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );
      const joined = sortedChapters
        .map((c: any) => (typeof c.spoken === "string" ? c.spoken.trim() : ""))
        .filter(Boolean)
        .join("\n\n");
      if (joined) {
        return {
          fullSpokenScript: joined,
          chapters: sortedChapters.map((c: any, i: number) => ({
            order: typeof c.order === "number" ? c.order : i + 1,
            title: c.title || `Chapter ${i + 1}`,
            durationSec: typeof c.durationSec === "number" ? c.durationSec : undefined,
            spoken: typeof c.spoken === "string" ? c.spoken : "",
          timecode: typeof c.timecode === "string" ? c.timecode : undefined,
          visual: typeof c.visual === "string" ? c.visual : undefined,
          })),
          source: "narrativeScriptObj",
          hasScript: true,
        };
      }
    }
  }

  // 1d. brief beats spokenLines joined
  const beats = Array.isArray(brief.beats)
    ? brief.beats
    : Array.isArray(prod.beats)
    ? prod.beats
    : [];
  if (beats.length > 0) {
    const beatLines = beats
      .map((b: any) => {
        if (Array.isArray(b.spokenLines)) return b.spokenLines.join(" ").trim();
        if (typeof b.spokenLines === "string") return b.spokenLines.trim();
        if (typeof b.spoken === "string") return b.spoken.trim();
        return "";
      })
      .filter(Boolean);
    if (beatLines.length > 0) {
      return {
        fullSpokenScript: beatLines.join("\n\n"),
        chapters: beats.map((b: any, i: number) => ({
          order: i + 1,
          title: b.title || b.label || `Beat ${i + 1}`,
          durationSec: typeof b.durationSec === "number" ? b.durationSec : undefined,
          spoken: Array.isArray(b.spokenLines)
            ? b.spokenLines.join(" ")
            : typeof b.spokenLines === "string"
            ? b.spokenLines
            : b.spoken || "",
        })),
        source: "beats",
        hasScript: true,
      };
    }
  }

  // 1e. spark.suggestedScript
  const suggested =
    spark.suggestedScript ||
    prod.suggestedScript ||
    brief.suggestedScript ||
    rev.suggestedScript;
  if (typeof suggested === "string" && suggested.trim()) {
    return {
      fullSpokenScript: suggested.trim(),
      chapters: [],
      source: "suggestedScript",
      hasScript: true,
    };
  }

  return {
    fullSpokenScript: "",
    chapters: [],
    source: "none",
    hasScript: false,
  };
}
