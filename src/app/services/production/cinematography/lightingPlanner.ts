import type { ShotLightingSpec } from "../specification/shotSpec";

export function planLightingForShot(params: {
  environment: string;
  timeOfDay?: string;
  tone?: string;
}): ShotLightingSpec {
  const time = params.timeOfDay || inferTime(params.environment);
  const tone = (params.tone || "").toLowerCase();
  return {
    direction: "key from camera-left, soft fill, controlled rim",
    intensity: tone.includes("dark") || tone.includes("thriller") ? "low-key" : "balanced cinematic",
    color: time === "night" ? "cool practicals" : time === "golden hour" ? "warm golden" : "neutral daylight-balanced",
    atmosphere: params.environment || "clean production atmosphere",
    timeOfDay: time,
  };
}

function inferTime(environment: string): string {
  const e = (environment || "").toLowerCase();
  if (e.includes("night") || e.includes("evening")) return "night";
  if (e.includes("sunset") || e.includes("golden")) return "golden hour";
  if (e.includes("morning")) return "morning";
  return "day";
}
