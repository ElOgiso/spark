import type { NarrativeScript, ViralSpark, ProductionBrief, ProductionBriefBeat } from "../../../domain/types";

export function applyNarrativeScriptToSparkAndBrief(
  script: NarrativeScript,
  spark?: ViralSpark | null,
  briefDraft?: Partial<ProductionBrief>
): { sparkPatch: Partial<ViralSpark>; brief: ProductionBrief } {
  
  let runningTime = 0;
  const beats: ProductionBriefBeat[] = script.chapters.map((c, i) => {
    const start = runningTime;
    runningTime += c.durationSec || 5;
    const end = runningTime;
    
    return {
      timecode: `[00:${String(start).padStart(2, '0')}-00:${String(end).padStart(2, '0')}]`,
      valueJob: c.job || "context",
      spokenLines: c.spoken,
      physicalAction: c.visualIntent,
      cameraDirection: c.visualIntent,
      onScreenText: "",
      startState: c.visualIntent,
      endState: c.visualIntent,
      audio: briefDraft?.productionMode === "express" ? "vo" : "talent",
      subject: "main",
      subjectType: "main",
    };
  });

  const brief: ProductionBrief = {
    title: script.title || briefDraft?.title || spark?.title || "Untitled",
    productionMode: briefDraft?.productionMode || "standard",
    targetDurationSec: script.targetDurationSec || briefDraft?.targetDurationSec || 60,
    hook: script.hook?.spoken || spark?.hook || "",
    scriptOutline: script.chapters.map(c => `${c.title} (${c.job}) - ${c.durationSec}s`).join("\n"),
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
    suggestedDuration: `${script.targetDurationSec || briefDraft?.targetDurationSec || 60}s`
  };

  const sparkPatch: Partial<ViralSpark> = {};
  if (spark) {
    sparkPatch.opening_line = script.hook?.spoken;
    sparkPatch.spoken_beats = script.chapters.map(c => c.spoken);
    sparkPatch.suggestedScript = script.fullSpokenScript;
    sparkPatch.narrativeScriptObj = script;
    
    if (!spark.hook || /formula|pattern|curiosity/i.test(spark.hook)) {
      sparkPatch.hook = script.hook?.spoken;
    }
    
    const wordCount = script.fullSpokenScript?.split(/\s+/).length || 0;
    if (wordCount >= 50) {
      sparkPatch.status = "ready";
    }

    if (spark.researchContext) {
      sparkPatch.researchContext = {
        ...spark.researchContext,
        openingLine: script.hook?.spoken,
        ctaLine: script.cta?.spoken,
        spokenBeats: script.chapters.map(c => c.spoken),
      };
    }
  }

  return { sparkPatch, brief };
}
