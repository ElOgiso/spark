import { ModelRouter } from "../../runtime/modelRouter";
import type { Brand, ViralSpark, StructuredResearchContext, NarrativeScript } from "../../../domain/types";
import { factCheckNarrativeScript, evaluateScriptForProduction } from "./scriptQualityGates";
import type { RetentionPolicy } from "../intelligence/autonomy";

export interface CompileNarrativeScriptParams {
  brand: Brand;
  targetDurationSec: number;
  productionModeLabel: "narrator" | "hybrid" | "cinematic" | string;
  spark?: ViralSpark | null;
  researchContext?: StructuredResearchContext;
  referenceChannel?: string;
  sourceUrls?: string[];
  userIntent?: string;
  mustNotCopy?: string[];
  retentionPolicy?: RetentionPolicy;
}

export function compileNarrativeScriptPrompt(params: CompileNarrativeScriptParams): string {
  const { brand, targetDurationSec, productionModeLabel, spark, researchContext, referenceChannel, sourceUrls, userIntent, mustNotCopy, retentionPolicy } = params;

  let prompt = `YOU ARE THE WRITER. SPARK IS THE STUDIO.
Return ONLY the typed script object.

Complete valid JSON is mandatory. Never cut off mid-object. chapters[].spoken is authoritative; fullSpokenScript may be omitted if chapters carry all spoken lines. Do NOT emit a duplicate fullSpokenScript field (SPARK will derive it).

JSON SAFETY & DIALOGUE RULES:
- Inside 'spoken' strings, do NOT use raw unescaped double quotes; use single quotes for dialogue or quotes ('like this') or proper JSON escaping (\\").
- Never emit literal unescaped newlines inside strings.
- Complete valid JSON is mandatory. Ensure all brackets, braces, and strings are fully closed.

Write a complete piece the viewer would watch for the FULL ${targetDurationSec} seconds.
Still write a full duration-sized script with substantive educational or narrative content matching the target duration.
Educational / story value required. Specific names, dates, mechanisms, stakes.
Open on payoff. Defer backstory.
Plant and resolve open loops appropriate to duration.
Do NOT write shot lists, camera manuals, or "generate a cinematic glow".
Do NOT write placeholder copy ("in this video we will discuss").

CLAIMS & FACT-CHECKING RULES:
- List claims you are making in the "claims" array; prefer verifiable facts.
- Use exact, verifiable dates, numbers, real entities, and mechanisms.
- Do NOT invent fake dates, fabricated names, or artificial statistics.

BRAND:
- Name: ${brand.name}
- Niche: ${brand.niche || "General"}
- Format: ${brand.contentFormat || "host"}
- Language: ${brand.language || "English"}
- Audience: ${brand.audience?.primary || "General Audience"}
- Tone: ${brand.tone?.filter((t: any) => t.active !== false).map((t: any) => t.label).join(", ") || "Authoritative"}

PRODUCTION MODE SPEECH POLICY:
- Mode: ${productionModeLabel}
${productionModeLabel === "narrator" ? "- Spoken lines must be Voiceover. Visuals are support. All chapters audio: 'vo'." : ""}
${productionModeLabel === "hybrid" ? "- Hybrid mode: label each chapter audio: 'vo' or 'talent'. Hook/payoff/cta with on-camera host -> 'talent'; proof/context explainer -> 'vo'." : ""}
${productionModeLabel === "cinematic" ? "- Spoken lines are IN-WORLD / talent. No 'narrator bed' instructions. Omit VO (all chapters talent)." : ""}

`;

  if (targetDurationSec) {
    prompt += `\nTarget Duration: ${targetDurationSec} seconds. Ensure the spoken script generates enough words to hit this duration naturally (approx 120-150 words per minute).\n`;
    prompt += `Return chapters that SUM to targetDurationSec (${targetDurationSec} seconds).\n`;
    prompt += `Each chapter has its own durationSec and spoken (movie structure, not a blob).\n`;
    prompt += `Do not omit durationSec. SPARK will not invent it.\n`;
  }

  if (spark) {
    prompt += `\nSOURCE SPARK (Core Concept):\n- Title: ${spark.title}\n- Hook: ${spark.hook}\n- Why Now: ${spark.whyNow}\n`;
  }

  if (userIntent) {
    prompt += `\nUSER INTENT:\n${userIntent}\n`;
  }

  if (referenceChannel) {
    prompt += `\nREFERENCE FORMAT: Borrow FORMAT (pacing, chapter shape, curiosity) from "${referenceChannel}". Do NOT retell their specific episodes or titles.\n`;
  }

  const forbiddenTitles = [
    ...(mustNotCopy || []),
    ...(spark?.mustNotCopy || []),
  ].filter(Boolean);

  if (forbiddenTitles.length > 0) {
    prompt += `\nDO NOT RETELL THESE TITLES (mustNotCopy):\n${forbiddenTitles.map((t) => `- "${t}"`).join("\n")}\nDo not retell these titles or clone their specific stories. Borrow format only; write an entirely original topic/episode.\n`;
  }

  if (sourceUrls && sourceUrls.length > 0) {
    prompt += `\nSOURCE URLs:\n${sourceUrls.join("\n")}\nIf you can fetch/watch/read this context with your tools, USE it. If you cannot access it, say so in claims and write from verified general knowledge. Do not invent a fake transcript.\n`;
  }

  const effectiveRetentionPolicy = retentionPolicy || (brand.settings?.retentionPolicy as RetentionPolicy | undefined);
  if (effectiveRetentionPolicy?.targetOpenLoopIntervalSec) {
    const interval = effectiveRetentionPolicy.targetOpenLoopIntervalSec;
    const plantEarly = Math.min(20, Math.max(10, Math.round(interval * 0.4)));
    prompt += `\nRETENTION OPEN-LOOP POLICY (DATA HINT):\n- Target open-loop interval: Plant open loops every ~${interval}s throughout the script.\n- Plant first open loop early (before ~${plantEarly}s) to prevent viewer drop-off.\n- Plant and resolve loops in openLoops.plantedAtSec and openLoops.resolvedAtSec.\n- Open on payoff, defer backstory.\n- Do NOT inject spoken lines from memory or copy past hook text verbatim; keep all narrative content original.\n`;
  }

  prompt += `
OUTPUT EXACTLY THIS JSON SHAPE:
{
  "title": "string",
  "logline": "string",
  "premise": "string",
  "targetDurationSec": ${targetDurationSec},
  "format": "${brand.contentFormat || "faceless"}",
  "hook": {
    "spoken": "string",
    "opensOnPayoff": true,
    "backstoryDeferred": true
  },
  "chapters": [
    {
      "id": "string",
      "order": 1,
      "title": "string",
      "durationSec": 10,
      "job": "hook | problem | context | proof | example | myth_bust | payoff | cta",
      "audio": "vo | talent (hybrid only: label each chapter vo or talent. cinematic: omit VO. narrator: vo)",
      "spoken": "REAL lines the audience hears, not camera notes (use single quotes for dialogue)",
      "visualIntent": "what we SEE, one sentence",
      "setsUpNextChapterId": "string"
    }
  ],
  "openLoops": { "plantedAtSec": [0], "resolvedAtSec": [45] },
  "cta": { "spoken": "string", "onScreen": "string" },
  "claims": [
    { "claim": "string", "verified": true, "source": "string" }
  ],
  "contentSource": "ai",
  "mustNotCopy": ["string"]
}
`;

  return prompt;
}

/**
 * Scans a JSON substring to balance unclosed braces and brackets.
 * Closes unclosed strings if interrupted, removes trailing commas,
 * and appends matching closing delimiters in LIFO order.
 */
export function balanceJsonDelimiters(jsonStr: string): string {
  if (!jsonStr || typeof jsonStr !== "string") return jsonStr;

  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      stack.push("}");
    } else if (char === "[") {
      stack.push("]");
    } else if (char === "}" || char === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === char) {
        stack.pop();
      }
    }
  }

  let repaired = jsonStr;
  if (inString) {
    repaired += '"';
  }

  // Strip trailing commas before closing delimiters
  repaired = repaired.replace(/,\s*$/, "");
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  while (stack.length > 0) {
    const closing = stack.pop()!;
    repaired = repaired.replace(/,\s*$/, "");
    repaired += closing;
  }

  return repaired;
}

/**
 * Isolates and extracts the outer JSON object ({...}) from model output text.
 * Strips markdown fences, slices from first '{' to last '}', attempts direct parse,
 * then attempts delimiter balance repair if needed.
 */
export function extractJsonObject(text: string): string {
  if (!text || typeof text !== "string") {
    throw new Error("Cannot extract JSON from empty or non-string input");
  }
  const stripped = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("No valid JSON object boundaries found in text (missing '{' or '}')");
  }

  const sliced = stripped.slice(firstBrace, lastBrace + 1);

  // 1. Direct parse test
  try {
    JSON.parse(sliced);
    return sliced;
  } catch (directErr) {
    // 2. Attempt balance repair: count unmatched { and [, append corresponding } and ]
    const balanced = balanceJsonDelimiters(sliced);
    try {
      JSON.parse(balanced);
      return balanced;
    } catch {
      // 3. Trailing comma light repair
      const repaired = tryLightJsonRepair(balanced);
      try {
        JSON.parse(repaired);
        return repaired;
      } catch (finalErr: any) {
        throw new Error(
          `Failed to parse extracted JSON (rawLength=${text.length}, extractedLength=${sliced.length}, endsWithBrace=${sliced.endsWith("}")}): ${finalErr?.message || finalErr}`
        );
      }
    }
  }
}

/**
 * Optional light repair for minor syntax issues such as trailing commas before } or ]
 * combined with delimiter balance repair.
 */
export function tryLightJsonRepair(jsonStr: string): string {
  if (!jsonStr || typeof jsonStr !== "string") return jsonStr;
  const commaFixed = jsonStr.replace(/,\s*([}\]])/g, "$1");
  return balanceJsonDelimiters(commaFixed);
}

export function distributeDurationAcrossChapters(
  targetDurationSec: number,
  wordCounts: number[]
): number[] {
  const n = wordCounts.length;
  if (n === 0) return [];
  if (n === 1) return [targetDurationSec];

  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  const minPerChapter = Math.min(2, Math.max(1, Math.floor(targetDurationSec / n)));

  let allocated: number[];
  if (totalWords > 0) {
    allocated = wordCounts.map((w) => {
      const share = Math.round((w / totalWords) * targetDurationSec);
      return Math.max(minPerChapter, share);
    });
  } else {
    const equalShare = Math.max(minPerChapter, Math.floor(targetDurationSec / n));
    allocated = Array(n).fill(equalShare);
  }

  let currentSum = allocated.reduce((a, b) => a + b, 0);
  let diff = targetDurationSec - currentSum;

  let idx = allocated.length - 1;
  let safetyLoops = 0;
  while (diff !== 0 && safetyLoops < 1000) {
    safetyLoops++;
    if (diff > 0) {
      allocated[idx]++;
      diff--;
    } else if (diff < 0 && allocated[idx] > minPerChapter) {
      allocated[idx]--;
      diff++;
    }
    idx = (idx - 1 + n) % n;
  }

  return allocated;
}

/**
 * Converts model prose, markdown beats, or malformed JSON into a valid NarrativeScript.
 */
export function proseFallbackToNarrativeScript(
  raw: string,
  params: CompileNarrativeScriptParams
): NarrativeScript {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new Error("Cannot construct NarrativeScript from empty model output.");
  }

  const cleanedRaw = raw
    .replace(/^```[a-z]*\s*/gim, "")
    .replace(/```\s*$/gm, "")
    .trim();

  // 1. Refusal check
  if (
    /^(I cannot|I am unable to|As an AI|I apologize, but I cannot)/i.test(cleanedRaw) &&
    cleanedRaw.length < 300
  ) {
    throw new Error(`Model refused request: ${cleanedRaw.slice(0, 120)}`);
  }

  const targetDurationSec = params.targetDurationSec;

  // 2. Extract Title
  let title = params.spark?.title || "";
  const rootTitleMatch = cleanedRaw.match(/"title"\s*:\s*[:\s]*"((?:[^"\\]|\\.)*)"/);
  if (rootTitleMatch && rootTitleMatch[1]) {
    title = rootTitleMatch[1].replace(/\\"/g, '"').trim();
  } else {
    const titleMatch = cleanedRaw.match(/^(?:#+\s*|Title:\s*)([^\n]+)/im);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    } else if (!title) {
      const firstLine = cleanedRaw.split("\n").map((l) => l.trim()).find((l) => l.length > 0 && l.length < 80);
      if (firstLine && !/^(here is|sure|okay|certainly)/i.test(firstLine)) {
        title = firstLine.replace(/^#+\s*/, "").replace(/^["']|["']$/g, "").trim();
      }
    }
  }
  if (!title) {
    title = "Untitled Production";
  }

  // 3. Extract Hook if demarcated
  let hookSpoken = "";
  const jsonHookMatch = cleanedRaw.match(/"hook"\s*:\s*\{[^}]*"spoken"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (jsonHookMatch && jsonHookMatch[1]) {
    hookSpoken = jsonHookMatch[1].replace(/\\"/g, '"').trim();
  } else {
    const hookMatch = cleanedRaw.match(/(?:Hook|Opening):\s*([^\n]+(?:\n[^\n]+)?)/i);
    if (hookMatch && hookMatch[1]) {
      hookSpoken = hookMatch[1].trim();
    }
  }

  // 4. Extract CTA if demarcated
  let ctaSpoken = (params.spark as any)?.cta || "";
  const jsonCtaMatch = cleanedRaw.match(/"cta"\s*:\s*\{[^}]*"spoken"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (jsonCtaMatch && jsonCtaMatch[1]) {
    ctaSpoken = jsonCtaMatch[1].replace(/\\"/g, '"').trim();
  } else {
    const ctaMatch = cleanedRaw.match(/(?:CTA|Call to Action|Outro):\s*([^\n]+(?:\n[^\n]+)?)/i);
    if (ctaMatch && ctaMatch[1]) {
      ctaSpoken = ctaMatch[1].trim();
    }
  }

  // 5. Look for broken JSON "spoken" fields first
  const jsonSpokenMatches = Array.from(cleanedRaw.matchAll(/"spoken"\s*:\s*"((?:[^"\\]|\\.)*)"/g))
    .map((m) => m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim())
    .filter(Boolean);

  let finalSections: Array<{ title?: string; text: string }> = [];

  if (jsonSpokenMatches.length > 0) {
    finalSections = jsonSpokenMatches.map((spoken, idx) => ({
      title: `Chapter ${idx + 1}`,
      text: spoken,
    }));
  } else {
    // Prose paragraph / heading segmentation
    let bodyText = cleanedRaw;
    const titleMatch = bodyText.match(/^(?:#+\s*|Title:\s*)([^\n]+)/im);
    if (titleMatch) {
      bodyText = bodyText.replace(titleMatch[0], "").trim();
    }

    const paragraphs = bodyText
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !/^(here is the script|below is the script|certainly,? here|sure,? here|here is your requested|hope this helps|let me know if)/i.test(p));

    const sections: Array<{ title?: string; text: string }> = [];
    const headingRegex = /^(?:#{1,4}\s+|(?:\*{1,2})?(?:Chapter|Beat|Scene|Part|Section)\s*\d*[:\-.]?\s*|\d+[\.\)]\s+)(.*?)(?:\*{1,2})?$/i;

    for (const p of paragraphs) {
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      const firstLine = lines[0];
      const match = firstLine.match(headingRegex);
      if (match && match[1] && lines.length > 1) {
        sections.push({
          title: match[1].replace(/[:\-]$/, "").trim(),
          text: lines.slice(1).join(" ").trim(),
        });
      } else if (match && match[1] && lines.length === 1) {
        sections.push({
          title: match[1].replace(/[:\-]$/, "").trim(),
          text: "",
        });
      } else {
        if (sections.length > 0 && sections[sections.length - 1].text === "") {
          sections[sections.length - 1].text = lines.join(" ").trim();
        } else {
          sections.push({
            title: undefined,
            text: lines.join(" ").trim(),
          });
        }
      }
    }

    const cleanedSections = sections
      .map((s) => {
        const cleanText = s.text
          .replace(/\[(?:visual|audio|camera|sfx|music|host|sound)?[^\]]*\]/gi, "")
          .replace(/\((?:visual|audio|camera|sfx|music|host|sound)?[^\)]*\)/gi, "")
          .replace(/^(?:spoken|narrator|host|vo):\s*/i, "")
          .trim();
        return {
          title: s.title,
          text: cleanText,
        };
      })
      .filter((s) => s.text.length > 0);

    if (
      cleanedSections.length > 1 &&
      /^(follow|subscribe|check out|click the link|leave a comment)/i.test(cleanedSections[cleanedSections.length - 1].text) &&
      cleanedSections[cleanedSections.length - 1].text.length < 120
    ) {
      const popped = cleanedSections.pop();
      if (!ctaSpoken && popped) ctaSpoken = popped.text;
    }

    finalSections = cleanedSections;
  }

  if (finalSections.length === 0) {
    throw new Error("No spoken-like content can be extracted from model output.");
  }

  // Cap / merge sections if > 10
  const maxChapters = 10;
  if (finalSections.length > maxChapters) {
    const merged: Array<{ title?: string; text: string }> = [];
    const ratio = Math.ceil(finalSections.length / maxChapters);
    for (let i = 0; i < finalSections.length; i += ratio) {
      const group = finalSections.slice(i, i + ratio);
      merged.push({
        title: group[0].title,
        text: group.map((g) => g.text).join(" "),
      });
    }
    finalSections = merged;
  }

  if (!hookSpoken && finalSections.length > 0) {
    hookSpoken = params.spark?.hook || finalSections[0].text;
  }
  if (!ctaSpoken) {
    ctaSpoken = `Follow for more ${params.brand?.name || "insights"}.`;
  }

  const numChapters = finalSections.length;
  const wordCounts = finalSections.map((s) => s.text.split(/\s+/).filter(Boolean).length);
  const rawDurations = distributeDurationAcrossChapters(targetDurationSec, wordCounts);

  const jobSequence = ["hook", "problem", "context", "proof", "example", "myth_bust", "payoff", "cta"];

  const chapters = finalSections.map((s, idx) => {
    let job = "context";
    if (idx === 0) job = "hook";
    else if (idx === numChapters - 1) job = numChapters > 2 ? "payoff" : "cta";
    else if (idx === 1) job = "problem";
    else if (idx < jobSequence.length) job = jobSequence[idx];

    let audio: "vo" | "talent" = "vo";
    if (params.productionModeLabel === "cinematic") {
      audio = "talent";
    } else if (params.productionModeLabel === "narrator") {
      audio = "vo";
    } else if (params.productionModeLabel === "hybrid") {
      audio = idx === 0 || idx === numChapters - 1 ? "talent" : "vo";
    }

    const chapterTitle = s.title || (idx === 0 ? "The Hook" : idx === numChapters - 1 ? "The Payoff" : `Chapter ${idx + 1}`);

    return {
      id: `c${idx + 1}`,
      order: idx + 1,
      title: chapterTitle,
      durationSec: rawDurations[idx],
      job,
      audio,
      spoken: s.text,
      visualIntent: `Visual presentation supporting ${chapterTitle.toLowerCase()}.`,
      setsUpNextChapterId: idx < numChapters - 1 ? `c${idx + 2}` : undefined,
    };
  });

  const fullSpoken = chapters.map((c) => c.spoken).filter(Boolean).join("\n\n");

  const script: NarrativeScript = {
    title,
    logline: params.spark?.whyNow || params.spark?.hook || hookSpoken.slice(0, 120),
    premise: params.spark?.title || params.userIntent || title,
    targetDurationSec,
    format: params.brand?.contentFormat || "faceless",
    hook: {
      spoken: hookSpoken,
      opensOnPayoff: true,
      backstoryDeferred: true,
    },
    chapters,
    fullSpokenScript: fullSpoken,
    openLoops: {
      plantedAtSec: [0],
      resolvedAtSec: [Math.round(targetDurationSec * 0.8)],
    },
    cta: {
      spoken: ctaSpoken,
      onScreen: "Follow",
    },
    claims: [],
    contentSource: "ai",
    mustNotCopy: params.mustNotCopy || [],
  };

  (script as any).normalizedFromProse = true;
  return script;
}

/**
 * Accepts model output string (JSON or prose) and normalizes into a validated NarrativeScript.
 * Order:
 * A) extractJsonObject + balanceJsonDelimiters + JSON.parse
 * B) If parse fails but raw has substantial text, proseFallbackToNarrativeScript(raw, params)
 * C) Only throw if raw is empty, clearly refusal-only, or no spoken-like content can be extracted
 */
export function normalizeToNarrativeScript(
  raw: string,
  params: CompileNarrativeScriptParams
): NarrativeScript {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new Error("Cannot normalize NarrativeScript from empty or missing text.");
  }

  // A) Try JSON extraction & parsing
  let parsedJsonObj: any = null;
  try {
    const cleanJson = extractJsonObject(raw);
    try {
      parsedJsonObj = JSON.parse(cleanJson);
    } catch {
      const repaired = tryLightJsonRepair(cleanJson);
      parsedJsonObj = JSON.parse(repaired);
    }
  } catch {
    parsedJsonObj = null;
  }

  // Preserve spoken beats from the existing ProductionBrief contract. Do not
  // accidentally narrate serialized JSON (including camera directions) as prose.
  if (parsedJsonObj && !Array.isArray(parsedJsonObj.chapters) && Array.isArray(parsedJsonObj.beats)) {
    parsedJsonObj.chapters = parsedJsonObj.beats.map((beat: any, index: number) => {
      const times = typeof beat.timecode === "string"
        ? beat.timecode.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/) : null;
      const durationSec = typeof beat.durationSec === "number" ? beat.durationSec
        : times ? Number(times[3]) * 60 + Number(times[4]) - Number(times[1]) * 60 - Number(times[2]) : undefined;
      return {
        id: `c${index + 1}`, order: index + 1,
        title: beat.title || `Chapter ${index + 1}`,
        spoken: typeof beat.spokenLines === "string" ? beat.spokenLines
          : Array.isArray(beat.spokenLines) ? beat.spokenLines.join(" ") : "",
        durationSec, job: beat.valueJob, audio: beat.audio,
        visualIntent: beat.physicalAction || beat.cameraDirection || "",
        setsUpNextChapterId: index < parsedJsonObj.beats.length - 1 ? `c${index + 2}` : undefined,
      };
    });
  }

  // If JSON parsed into a structure with chapters or spoken content, normalize and return
  if (
    parsedJsonObj &&
    typeof parsedJsonObj === "object" &&
    !Array.isArray(parsedJsonObj) &&
    ((Array.isArray(parsedJsonObj.chapters) && parsedJsonObj.chapters.length > 0) || parsedJsonObj.fullSpokenScript || parsedJsonObj.title)
  ) {
    if (!parsedJsonObj.title) {
      parsedJsonObj.title = params.spark?.title || "Untitled Production";
    }
    if (!parsedJsonObj.format) {
      parsedJsonObj.format = params.brand?.contentFormat || "faceless";
    }
    if (!parsedJsonObj.targetDurationSec) {
      parsedJsonObj.targetDurationSec = params.targetDurationSec;
    }
    if (typeof parsedJsonObj.hook === "string") {
      parsedJsonObj.hook = { spoken: parsedJsonObj.hook, opensOnPayoff: false, backstoryDeferred: false };
    }
    if (!parsedJsonObj.hook || typeof parsedJsonObj.hook !== "object" || Array.isArray(parsedJsonObj.hook)) {
      parsedJsonObj.hook = {
        spoken: params.spark?.hook || parsedJsonObj.chapters?.[0]?.spoken || "",
        opensOnPayoff: true,
        backstoryDeferred: true,
      };
    } else if (!parsedJsonObj.hook.spoken) {
      parsedJsonObj.hook.spoken = params.spark?.hook || parsedJsonObj.chapters?.[0]?.spoken || "";
    }
    if (!parsedJsonObj.contentSource) {
      parsedJsonObj.contentSource = "ai";
    }
    if (!Array.isArray(parsedJsonObj.mustNotCopy)) {
      parsedJsonObj.mustNotCopy = params.mustNotCopy || [];
    }
    if (!parsedJsonObj.openLoops) {
      parsedJsonObj.openLoops = {
        plantedAtSec: [0],
        resolvedAtSec: [Math.round(params.targetDurationSec * 0.8)],
      };
    }
    if (!parsedJsonObj.cta) {
      parsedJsonObj.cta = {
        spoken: `Follow for more ${params.brand?.name || "insights"}.`,
        onScreen: "Follow",
      };
    }

    // Derive fullSpokenScript if omitted
    if (!parsedJsonObj.fullSpokenScript || typeof parsedJsonObj.fullSpokenScript !== "string" || !parsedJsonObj.fullSpokenScript.trim()) {
      if (Array.isArray(parsedJsonObj.chapters) && parsedJsonObj.chapters.length > 0) {
        const derived = parsedJsonObj.chapters
          .map((c: any) => (typeof c.spoken === "string" ? c.spoken.trim() : ""))
          .filter(Boolean)
          .join("\n\n");
        if (derived) {
          parsedJsonObj.fullSpokenScript = derived;
        }
      }
    }

    // If chapters are present and spoken script is non-empty, return parsed JSON
    if (Array.isArray(parsedJsonObj.chapters) && parsedJsonObj.chapters.length > 0 && parsedJsonObj.fullSpokenScript) {
      return parsedJsonObj as NarrativeScript;
    }
  }

  // B) Fallback to prose conversion
  return proseFallbackToNarrativeScript(raw, params);
}

export async function compileNarrativeScript(params: CompileNarrativeScriptParams): Promise<NarrativeScript> {
  if (!params.targetDurationSec || params.targetDurationSec <= 0 || isNaN(params.targetDurationSec)) {
    throw new Error("No target duration. SPARK will not assume 60 seconds.");
  }
  const prompt = compileNarrativeScriptPrompt(params);

  // Exactly one production call — no paid Claude retry loop
  let rawOutput = "";
  try {
    rawOutput = await ModelRouter.executeCategoryRequest("production", {
      prompt,
      systemInstruction: "You are the SPARK scriptwriter. Return the complete video script.",
      maxTokens: 8192,
    });
  } catch (error: any) {
    throw new Error(`Failed to execute narrative script prompt: ${error?.message || error}`);
  }

  if (!rawOutput || !rawOutput.trim()) {
    throw new Error("Model returned empty output for narrative script.");
  }

  // Normalize directly (JSON extraction or prose fallback)
  const scriptObj = normalizeToNarrativeScript(rawOutput, params);

  // fullSpokenScript safety: derive from chapters[].spoken if missing or empty
  if (!scriptObj.fullSpokenScript || typeof scriptObj.fullSpokenScript !== "string" || !scriptObj.fullSpokenScript.trim()) {
    if (Array.isArray(scriptObj.chapters) && scriptObj.chapters.length > 0) {
      const derived = scriptObj.chapters
        .map((c: any) => (typeof c.spoken === "string" ? c.spoken.trim() : ""))
        .filter(Boolean)
        .join("\n\n");
      if (derived) {
        scriptObj.fullSpokenScript = derived;
      }
    }
  }

  if (!scriptObj.fullSpokenScript || typeof scriptObj.fullSpokenScript !== "string" || !scriptObj.fullSpokenScript.trim()) {
    throw new Error("Validation Failed: fullSpokenScript is missing or empty.");
  }

  const wordCount = scriptObj.fullSpokenScript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 20) {
    throw new Error(`Validation Failed: fullSpokenScript is too short (${wordCount} words). Real spoken content required.`);
  }

  const minWords = Math.floor((params.targetDurationSec / 60) * 100);
  if (wordCount < minWords) {
    console.warn(
      `[compileNarrativeScript] Warning: fullSpokenScript word count (${wordCount}) is below target pacing (${minWords} words for ${params.targetDurationSec}s).`
    );
  }

  // Camera direction check: warn or filter, avoid hard fail
  const isCameraDirection = scriptObj.chapters?.some((c: any) =>
    c.spoken && /medium shot|close up|camera|pan|zoom/i.test(c.spoken) && c.spoken.length < 50
  );
  if (isCameraDirection) {
    console.warn("[compileNarrativeScript] Chapters contain camera directions in spoken text; keeping spoken text.");
  }

  // Title and spoken hook fallback
  if (!scriptObj.title) {
    scriptObj.title = params.spark?.title || "Untitled Production";
  }
  if (!scriptObj.hook) {
    scriptObj.hook = { spoken: "", opensOnPayoff: true, backstoryDeferred: true };
  }
  if (!scriptObj.hook.spoken) {
    scriptObj.hook.spoken = params.spark?.hook || scriptObj.chapters?.[0]?.spoken || "";
  }
  if (!scriptObj.title || !scriptObj.hook?.spoken) {
    throw new Error("Validation Failed: Script payload is title-only or missing spoken hook.");
  }

  // Single-pass fact check for claims (one model call max)
  const factCheckedScript = await factCheckNarrativeScript(scriptObj as NarrativeScript, params.brand);

  const refTitles = [
    ...(params.mustNotCopy || []),
    ...(params.spark?.mustNotCopy || []),
  ].filter(Boolean);

  // Evaluate script quality gates (attaches genericity, originality, and overlap scores)
  evaluateScriptForProduction(factCheckedScript, params.spark, params.brand, refTitles);

  return factCheckedScript;
}
