import type { NarrativeScript, ViralSpark, ProductionBrief, ProductionBriefBeat, Brand } from "../../../domain/types";
import { evaluateScriptForProduction, type ScriptEvaluationResult } from "./scriptQualityGates";
import { resolveChapterAudio } from "./chapterAudio";

function formatTimecode(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function applyNarrativeScriptToSparkAndBrief(
  script: NarrativeScript,
  spark?: ViralSpark | null,
  briefDraft?: Partial<ProductionBrief>,
  options?: { brand?: Brand; referenceTitles?: string[] }
): { sparkPatch: Partial<ViralSpark>; brief: ProductionBrief; evaluation: ScriptEvaluationResult } {
  const targetDurationSec = script.targetDurationSec ?? briefDraft?.targetDurationSec;
  const chapterValidationErrors: string[] = [];
  const chapters = script.chapters || [];

  let runningTime = 0;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    if (typeof c.durationSec !== "number" || c.durationSec <= 0 || isNaN(c.durationSec)) {
      chapterValidationErrors.push(`Chapter ${i + 1} has no duration from the writer.`);
    }
    if (!c.spoken || typeof c.spoken !== "string" || !c.spoken.trim()) {
      chapterValidationErrors.push(`Chapter ${i + 1} has no spoken lines from the writer.`);
    }
  }

  const beats: ProductionBriefBeat[] = chapters.map((c) => {
    const start = runningTime;
    const dur = typeof c.durationSec === "number" && c.durationSec > 0 ? c.durationSec : 0;
    runningTime += dur;
    const end = runningTime;

    return {
      timecode: `[${formatTimecode(start)}-${formatTimecode(end)}]`,
      valueJob: c.job || "context",
      spokenLines: c.spoken,
      physicalAction: c.visualIntent,
      cameraDirection: c.visualIntent,
      onScreenText: "",
      startState: c.visualIntent,
      endState: c.visualIntent,
      audio: resolveChapterAudio({ mode: briefDraft?.productionMode, chapter: c }),
      subject: "main",
      subjectType: "main",
      durationSec: c.durationSec,
    };
  });

  if (targetDurationSec && targetDurationSec > 0) {
    const diff = Math.abs(runningTime - targetDurationSec);
    if (diff / targetDurationSec > 0.15) {
      chapterValidationErrors.push(
        `Script chapters sum to ${runningTime}s, which deviates by more than 15% from target duration ${targetDurationSec}s.`
      );
    }
  }

  const brief: ProductionBrief = {
    title: script.title || briefDraft?.title || spark?.title || "Untitled",
    productionMode: briefDraft?.productionMode || "standard",
    targetDurationSec: targetDurationSec,
    hook: script.hook?.spoken || spark?.hook || "",
    scriptOutline: chapters.map((c) => `${c.title} (${c.job}) - ${c.durationSec}s`).join("\n"),
    beats,
    spokenCta: script.cta?.spoken || "",
    onScreenCta: script.cta?.onScreen || "",
    visualDirection: "Guided by narrative script",
    caption: "",
    platformRecommendation: spark?.platformFit || (briefDraft?.productionMode === "deep" ? "YouTube Long-form" : "YouTube Shorts"),
    whyThisWorks: script.logline + " " + script.premise,
    contentSource: script.contentSource || "ai",
    narrativeScript: script,
    brandFitScore: briefDraft?.brandFitScore || spark?.brandFitScore || 90,
    suggestedDuration: targetDurationSec ? `${targetDurationSec}s` : "",
  };

  const evaluation = evaluateScriptForProduction(
    script,
    spark,
    options?.brand,
    options?.referenceTitles
  );

  if (!targetDurationSec || targetDurationSec <= 0) {
    evaluation.ok = false;
    evaluation.reasons.unshift("No target duration. SPARK will not assume 60 seconds.");
  }
  if (chapterValidationErrors.length > 0) {
    evaluation.ok = false;
    evaluation.reasons.unshift(...chapterValidationErrors);
  }

  brief.genericityScore = evaluation.scores.genericityScore;
  brief.originalityScore = evaluation.scores.originalityScore;
  brief.referenceContentOverlapScore = evaluation.scores.referenceContentOverlapScore;
  if (!evaluation.ok) {
    brief.lastError = evaluation.reasons[0];
  }

  const sparkPatch: Partial<ViralSpark> = {
    genericityScore: evaluation.scores.genericityScore,
    originalityScore: evaluation.scores.originalityScore,
    referenceContentOverlapScore: evaluation.scores.referenceContentOverlapScore,
  };

  if (spark) {
    sparkPatch.opening_line = script.hook?.spoken;
    sparkPatch.spoken_beats = chapters.map((c) => c.spoken);
    sparkPatch.suggestedScript = script.fullSpokenScript;
    sparkPatch.narrativeScriptObj = script;

    if (!spark.hook || /formula|pattern|curiosity/i.test(spark.hook)) {
      sparkPatch.hook = script.hook?.spoken;
    }

    if (!evaluation.ok) {
      sparkPatch.status = "draft";
      sparkPatch.lastError = evaluation.reasons[0];
    } else {
      sparkPatch.status = "ready";
    }

    if (spark.researchContext) {
      sparkPatch.researchContext = {
        ...spark.researchContext,
        openingLine: script.hook?.spoken,
        ctaLine: script.cta?.spoken,
        spokenBeats: chapters.map((c) => c.spoken),
      };
    }
  }

  return { sparkPatch, brief, evaluation };
}
