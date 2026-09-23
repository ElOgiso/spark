import assert from "node:assert/strict";
import test from "node:test";
import type { Production } from "../../domain/types";
import { legacyProductionToSpec, productionSpecToBrief } from "./specification/adapters";
import { resolveGeneratePlan, resolveSceneGeneratePlan } from "./resolveGeneratePlan";
import { planGenerationTasks, attachGenerationTasksToSpec, resolveGenerationTasks } from "./generation/generationPlanner";
import { prepareTaskInputs } from "./execution/inputPreparation";

function fixture(mode: string) {
  return legacyProductionToSpec({ production: {
    id: "formats", title: "Mode contract", status: "Drafting", mode,
    dateCreated: "2026-09-23", scenes: [], formats: [],
    brief: { title: "Mode contract", storyboard: [
      { sceneNumber: 1, duration: "5s", audio: "talent", spokenLines: "On camera hook", valueJob: "hook", visualDescription: "Host" },
      { sceneNumber: 2, duration: "5s", audio: "vo", spokenLines: "Narrated proof", valueJob: "proof", visualDescription: "Evidence" },
      { sceneNumber: 3, duration: "5s", audio: "talent", spokenLines: "On camera close", valueJob: "cta", visualDescription: "Host" },
    ] },
  } as Production });
}

for (const [mode, videos, voices] of [["narrator", 0, 1], ["hybrid", 2, 1], ["cinematic", 3, 0], ["slideshow", 0, 1], ["filmic", 3, 0]] as const) {
  test(`Phase 13: ${mode} uses the shared production graph`, () => {
    const spec = fixture(mode);
    const tasks = planGenerationTasks(spec);
    assert.equal(tasks.filter(t => t.kind === "video").length, videos);
    assert.equal(tasks.filter(t => t.kind === "voice").length, voices);
    const ids = new Set(tasks.map(t => t.id));
    for (const task of tasks) for (const dependency of task.dependsOn) assert.ok(ids.has(dependency), dependency);
    assert.equal(spec.creative.requiresVoiceGeneration, voices > 0);
    assert.equal(spec.creative.requiresVideoGeneration, videos > 0);
  });
}

test("Phase 13: Hybrid voice reads only narration; still-to-video has no missing continuity dependency", () => {
  const spec = fixture("hybrid");
  spec.continuity.lastFrameChainEnabled = true;
  const tasks = planGenerationTasks(spec);
  const voice = tasks.find(t => t.kind === "voice")!;
  assert.equal(prepareTaskInputs({ spec, task: voice }).prompt, "Narrated proof");
  const middle = spec.scenes[1].shots[0].id;
  assert.ok(!tasks.some(t => t.dependsOn.includes(`${middle}_video`)));
});

test("Phase 13: saved tasks cannot restore excluded video or external cinematic voice", () => {
  const old = fixture("cinematic");
  const oldTasks = planGenerationTasks(old);
  const narrator = fixture("narrator");
  const saved = attachGenerationTasksToSpec(narrator, oldTasks);
  const resolved = resolveGenerationTasks(saved);
  assert.equal(resolved.tasks.filter(t => t.kind === "video").length, 0);
  const ids = new Set(resolved.tasks.map(t => t.id));
  for (const task of resolved.tasks) for (const dep of task.dependsOn) assert.ok(ids.has(dep));
  const cinematic = attachGenerationTasksToSpec(old, planGenerationTasks(narrator));
  assert.ok(!resolveGenerationTasks(cinematic).tasks.some(t => t.kind === "voice"));
});

test("Phase 13: silent talent survives roundtrip and Narrator overrides stale talent flags", () => {
  const spec = fixture("hybrid");
  spec.scenes[0].dialogue = undefined;
  spec.scenes[0].spokenLines = undefined;
  assert.equal(productionSpecToBrief(spec).storyboard?.[0].audio, "talent");
  assert.equal(resolveGeneratePlan("narrator", { title: "Old", beats: [{ scene: 1, audio: "talent" }] }).skipExternalVoice, false);
  assert.deepEqual(resolveSceneGeneratePlan("hybrid", { valueJob: "hook" }), { audio: "talent", stillOnly: false });
  assert.deepEqual(resolveSceneGeneratePlan("hybrid", { audio: "vo", valueJob: "hook" }), { audio: "vo", stillOnly: true });
});

test("Phase 13: visual planning cannot add operational video tasks to Narrator or Hybrid VO scenes", async () => {
  const { createProductionPlan } = await import("./intelligence/productionOrchestrator");
  const { applyVisualPlanningPipeline } = await import("./generation/visualPlanningPipeline");
  const grammar = createProductionPlan({ idea: "A host demonstrates a useful workflow", targetDurationSec: 15 }).grammar!;
  for (const mode of ["narrator", "hybrid"]) {
    const spec = fixture(mode);
    const result = applyVisualPlanningPipeline(spec, { grammar, preferI2V: true });
    const stillScenes = new Set(spec.scenes.filter(scene => resolveSceneGeneratePlan(mode, scene).stillOnly).map(scene => scene.id));
    assert.ok(result.generationTasks.some(task => task.kind === "keyframe"));
    assert.ok(!result.generationTasks.some(task => task.kind === "video" && stillScenes.has(task.sceneId!)));
    for (const scene of result.spec.scenes.filter(scene => stillScenes.has(scene.id))) {
      assert.ok(scene.shots.every(shot => shot.generationStrategy === "slideshow_still"));
    }
  }
});

test("Phase 13: changed merge inputs invalidate completed output without resetting uncertain execution", () => {
  const spec = fixture("narrator");
  const old = planGenerationTasks(fixture("cinematic"));
  const merge = old.find(task => task.kind === "merge")!;
  merge.status = "succeeded";
  merge.productionAssetId = "old-master";
  let resolved = resolveGenerationTasks(attachGenerationTasksToSpec(spec, old));
  assert.equal(resolved.tasks.find(task => task.kind === "merge")?.status, "blocked");
  assert.equal(resolved.tasks.find(task => task.kind === "merge")?.productionAssetId, undefined);
  merge.status = "failed";
  merge.lastError = "UNKNOWN_SUBMISSION";
  resolved = resolveGenerationTasks(attachGenerationTasksToSpec(spec, old));
  assert.equal(resolved.tasks.find(task => task.kind === "merge")?.lastError, "UNKNOWN_SUBMISSION");
});
