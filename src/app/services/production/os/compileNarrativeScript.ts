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
${productionModeLabel === "narrator" ? "- Spoken lines must be Voiceover. Visuals are support." : ""}
${productionModeLabel === "hybrid" ? "- Mark chapters as audio: 'vo' or 'talent'." : ""}
${productionModeLabel === "cinematic" ? "- Spoken lines are IN-WORLD / talent. No 'narrator bed' instructions." : ""}

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
      "spoken": "REAL lines the audience hears, not camera notes",
      "visualIntent": "what we SEE, one sentence",
      "setsUpNextChapterId": "string"
    }
  ],
  "fullSpokenScript": "string (concatenated spoken)",
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

export async function compileNarrativeScript(params: CompileNarrativeScriptParams): Promise<NarrativeScript> {
  if (!params.targetDurationSec || params.targetDurationSec <= 0 || isNaN(params.targetDurationSec)) {
    throw new Error("No target duration. SPARK will not assume 60 seconds.");
  }
  const prompt = compileNarrativeScriptPrompt(params);

  let rawJson = "";
  try {
    rawJson = await ModelRouter.executeCategoryRequest("production", {
      prompt,
      systemInstruction: "You are the SPARK scriptwriter. Return ONLY valid JSON.",
      
    });
  } catch (error) {
    throw new Error(`Failed to execute narrative script prompt: ${error}`);
  }

  let scriptObj: any;
  try {
    const cleanJson = rawJson.replace(/^```json/i, "").replace(/```$/, "").trim();
    scriptObj = JSON.parse(cleanJson);
  } catch (parseError) {
    console.warn("[compileNarrativeScript] First JSON parse failed, retrying...");
    try {
      const retryRaw = await ModelRouter.executeCategoryRequest("production", {
        prompt: `FIX THIS JSON:\n\n${rawJson}\n\nERROR:\n${parseError}\n\nRETURN ONLY VALID JSON matching the narrative script schema.`,
        systemInstruction: "You are a JSON repair bot. Return ONLY valid JSON.",
        
      });
      const cleanRetry = retryRaw.replace(/^```json/i, "").replace(/```$/, "").trim();
      scriptObj = JSON.parse(cleanRetry);
    } catch (retryError) {
      throw new Error(`Failed to parse NarrativeScript JSON after retry: ${retryError}`);
    }
  }

  if (!scriptObj.fullSpokenScript || typeof scriptObj.fullSpokenScript !== "string") {
    throw new Error("Validation Failed: fullSpokenScript is missing or empty.");
  }
  
  const wordCount = scriptObj.fullSpokenScript.split(/\s+/).length;
  const minWords = Math.floor((params.targetDurationSec / 60) * 100); 
  if (wordCount < minWords) {
    throw new Error(`Validation Failed: fullSpokenScript is too short for target duration (${wordCount} words for ${params.targetDurationSec}s).`);
  }

  const isCameraDirection = scriptObj.chapters?.some((c: any) => 
    c.spoken && /medium shot|close up|camera|pan|zoom/i.test(c.spoken) && c.spoken.length < 50
  );
  if (isCameraDirection) {
    throw new Error("Validation Failed: Chapters contain camera directions instead of real spoken language.");
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
