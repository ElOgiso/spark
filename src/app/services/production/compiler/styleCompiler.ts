/**
 * Style & Lighting Compiler for Provider Payload Compiler.
 *
 * Compiles:
 * - StyleBible (visualLanguage, color, lighting, environment, constraints)
 * - ShotLightingSpec (direction, intensity, color, atmosphere, timeOfDay)
 *
 * Avoids verbose adjective spam, compiling structured visual intent.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { StyleBible } from "../specification/styleBible";

export interface StyleCompilationResult {
  lightingDirectives: string[];
  styleDirectives: string[];
  negativeStyleConstraints: string[];
}

export function compileStyleAndLighting(params: {
  shot: ShotSpec;
  styleBible?: StyleBible;
}): StyleCompilationResult {
  const { shot, styleBible } = params;
  const lightingDirectives: string[] = [];
  const styleDirectives: string[] = [];
  const negativeStyleConstraints: string[] = [];

  // 1. Shot Lighting Spec
  const l = shot.lighting;
  if (l) {
    const lParts: string[] = [];
    if (l.timeOfDay) lParts.push(`Time: ${l.timeOfDay}`);
    if (l.direction) lParts.push(`Direction: ${l.direction}`);
    if (l.intensity) lParts.push(`Intensity: ${l.intensity}`);
    if (l.color) lParts.push(`Tone: ${l.color}`);
    if (l.atmosphere) lParts.push(`Atmosphere: ${l.atmosphere}`);
    if (lParts.length) {
      lightingDirectives.push(`LIGHTING: ${lParts.join(", ")}`);
    }
  }

  // 2. StyleBible Integration
  if (styleBible) {
    const vl = styleBible.visualLanguage;
    if (vl) {
      styleDirectives.push(`VISUAL AESTHETIC: ${vl.aesthetic}${vl.realismLevel ? ` (${vl.realismLevel})` : ""}`);
      if (vl.texture) styleDirectives.push(`TEXTURE: ${vl.texture}`);
    }

    const c = styleBible.color;
    if (c) {
      styleDirectives.push(`COLOR PALETTE: ${c.palette}${c.temperature ? `, ${c.temperature} balance` : ""}`);
    }

    const sLight = styleBible.lighting;
    if (sLight && !l?.direction) {
      lightingDirectives.push(`LIGHTING MOOD: ${sLight.keyMood}${sLight.contrast ? ` with ${sLight.contrast} contrast` : ""}`);
    }

    if (styleBible.constraints?.negativeRules) {
      negativeStyleConstraints.push(...styleBible.constraints.negativeRules);
    }
  }

  return {
    lightingDirectives,
    styleDirectives,
    negativeStyleConstraints,
  };
}
