import type { ShotLightingSpec } from "../specification/shotSpec";
import type { NarrativeFunction } from "../specification/sceneSpec";

export function planLightingForShot(params: {
  environment: string;
  timeOfDay?: string;
  tone?: string;
  narrativeFunction?: NarrativeFunction;
  genre?: string;
}): ShotLightingSpec {
  const time = params.timeOfDay || inferTime(params.environment);
  const tone = (params.tone || "").toLowerCase();
  const fn = params.narrativeFunction;
  const genre = (params.genre || "").toLowerCase();

  const lowKey =
    tone.includes("dark") ||
    tone.includes("thriller") ||
    tone.includes("tension") ||
    fn === "confrontation";

  const luxury = genre.includes("advertisement") || tone.includes("premium") || tone.includes("luxury");
  const documentary = genre.includes("documentary") || genre.includes("news");

  let direction = "key from camera-left, soft fill, controlled rim";
  if (luxury) direction = "soft key with elegant rim; minimal fill; specular control on product";
  if (documentary) direction = "motivated practical key; observational fill; avoid glamorous over-light";
  if (fn === "product") direction = "hero key on product; soft wrap fill; subtle rim for edge separation";
  if (lowKey) direction = "hard motivated key; sparse fill; deep negative fill for tension";

  return {
    direction,
    intensity: lowKey ? "low-key contrast" : luxury ? "controlled high-key premium" : "balanced cinematic",
    color:
      time === "night"
        ? "cool practicals with warm accents"
        : time === "golden hour"
          ? "warm golden motivated sun"
          : luxury
            ? "neutral-warm premium grade"
            : "neutral daylight-balanced",
    atmosphere: atmosphereFor(params.environment, fn, documentary),
    timeOfDay: time,
  };
}

function atmosphereFor(environment: string, fn?: NarrativeFunction, documentary?: boolean): string {
  if (fn === "broll" || documentary) {
    return `${environment || "location"} — observational atmosphere; motivated practicals only`;
  }
  if (fn === "product") {
    return "clean product stage atmosphere; controlled reflections";
  }
  return environment || "clean production atmosphere";
}

function inferTime(environment: string): string {
  const e = (environment || "").toLowerCase();
  if (e.includes("night") || e.includes("evening")) return "night";
  if (e.includes("sunset") || e.includes("golden")) return "golden hour";
  if (e.includes("morning")) return "morning";
  return "day";
}
