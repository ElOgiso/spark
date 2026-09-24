import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import { applyLongFormVisualPlanning, assertVisualPlanExecutable } from "./generation/strategyResolver";
import { renderVisualGraphicSvg } from "./generation/visualMedia";
import { resolveGenerationTasks } from "./generation/generationPlanner";
import { GenerationExecutionEngine } from "./execution/executionEngine";
import { prepareTaskInputs } from "./execution/inputPreparation";
import { createMemoryAssetPersistPort } from "./execution/outputNormalization";
import { compileMixedVisualVideo } from "./narratorVideoCompiler";
import type { ShotSpec } from "./specification/shotSpec";

function fixture(plan: ShotSpec["visualPlan"]) {
  const spec = createProductionPlan({ idea: "Explain a simple concept", targetDurationSec: 30 }).spec!;
  const shot = spec.scenes[0].shots[0];
  spec.scenes = [{ ...spec.scenes[0], shots: [{ ...shot, durationSec: 5, visualPlan: plan, generationTasks: [] }] }];
  spec.productionTasks = [];
  spec.audio.hasNarration = false;
  return spec;
}

describe("Phase 14 source and factual visual execution", () => {
  it("reuses existing uploaded media without creating another video task", () => {
    const spec = fixture({ kind: "USER_ASSET", reason: "Use supplied footage" });
    spec.scenes[0].shots[0].mediaUrl = "https://media.example/footage.mp4";
    const planned = applyLongFormVisualPlanning(spec);
    assert.equal(planned.scenes[0].shots[0].visualPlan?.source?.url, spec.scenes[0].shots[0].mediaUrl);
    assert.doesNotThrow(() => assertVisualPlanExecutable(planned));
    assert.equal(resolveGenerationTasks(planned).tasks.filter(t => t.kind === "video").length, 0);
  });

  it("sources licensed video through the canonical task, at zero provider spend, and restores it on retry", async () => {
    const spec = fixture({ kind: "STOCK", reason: "Archive", source: { url: "https://media.example/archive.mp4", mediaType: "video", attribution: "Licensed archive 123" } });
    let submits = 0;
    const persistPort = createMemoryAssetPersistPort();
    const engine = new GenerationExecutionEngine({ persistPort, ports: { submitImage: async () => { submits++; throw new Error("No image spend"); }, submitVideo: async () => { submits++; throw new Error("No video spend"); } } });
    const resolved = resolveGenerationTasks(spec);
    assert.equal(resolved.tasks.filter(t => t.kind === "keyframe").length, 1, "unused reference tasks are omitted");
    const task = resolved.tasks.find(t => t.kind === "keyframe")!;
    const result = await engine.executeTask({ spec: resolved.spec, task });
    assert.equal(result.asset?.assetType, "video");
    assert.equal(result.asset?.publicUrl, "https://media.example/archive.mp4");
    assert.equal(result.execution.usage?.actualCost, 0);
    const replay = await new GenerationExecutionEngine({ persistPort }).executeTask({ spec: resolved.spec, task });
    assert.equal(replay.asset?.id, result.asset?.id);
    assert.equal(persistPort.assets.length, 1);
    assert.equal(submits, 0);
    resolved.spec.scenes[0].shots[0].visualPlan!.source!.url = "https://media.example/replacement.mp4";
    await assert.rejects(engine.executeTask({ spec: resolved.spec, task }), (error: any) => error.code === "invalid_request" && error.retryability === "DO_NOT_RETRY" && /Source visual changed/.test(error.message));
    assert.equal(persistPort.assets.length, 1);
  });

  it("rejects missing facts, invalid coordinates and unsafe source schemes before execution", () => {
    for (const plan of [
      { kind: "CHART", reason: "test", graphic: { title: "Data", bars: [{ label: "a", value: NaN }], sourceLabel: "dataset" } },
      { kind: "MAP", reason: "test", graphic: { title: "Route", points: [{ label: "a", longitude: 181, latitude: 0 }], sourceLabel: "dataset" } },
      { kind: "SCREENSHOT", reason: "test", source: { url: "javascript:alert(1)", mediaType: "image", attribution: "site" } },
    ] as ShotSpec["visualPlan"][]) assert.throws(() => assertVisualPlanExecutable(fixture(plan)), /sourcing\/rendering/);
  });

  it("renders supplied facts and escapes text without remote dependencies", () => {
    const spec = fixture({ kind: "CHART", reason: "test", graphic: { title: '<script>alert("x")</script>', sourceLabel: "Measured data", bars: [{ label: "A&B", value: 12 }] } });
    const svg = renderVisualGraphicSvg(spec.scenes[0].shots[0]);
    assert.ok(svg.includes("A&amp;B")); assert.ok(svg.includes("Measured data"));
    assert.ok(svg.includes(">12</text>")); assert.ok(!svg.includes("<script>"));
    assert.ok(!svg.includes("<image"));
  });

  it("reveals motion graphics in deterministic step order", () => {
    const shot = fixture({ kind: "MOTION_GRAPHIC", reason: "test", graphic: { title: "Process", steps: ["Start", "Finish"] } }).scenes[0].shots[0];
    assert.ok(!renderVisualGraphicSvg(shot, .5).includes("Finish"));
    assert.ok(renderVisualGraphicSvg(shot, 1).includes("Finish"));
  });

  it("keeps images, supplied video and narration typed and ordered in merge inputs", () => {
    const spec = fixture({ kind: "IMAGE", reason: "Still" });
    const first = spec.scenes[0].shots[0];
    spec.scenes[0].shots.push({ ...first, id: "stock_2", visualPlan: { kind: "STOCK", reason: "Archive", source: { url: "https://media.example/a.mp4", mediaType: "video", attribution: "Archive" } } });
    spec.audio.hasNarration = true;
    const resolved = resolveGenerationTasks(spec);
    const task = resolved.tasks.find(t => t.kind === "merge")!;
    const priorOutputs = Object.fromEntries(task.dependsOn.map(id => [id, `https://media.example/${id}`]));
    const inputs = prepareTaskInputs({ spec: resolved.spec, task, priorOutputs }).inputs;
    assert.deepEqual(inputs.map(i => i.role), ["other", "source_video", "audio"]);
    assert.deepEqual(inputs.slice(0, 2).map(i => i.durationSec), [5, 5]);
  });

  it("accepts multiple selected video beats in a long-form mixed timeline", () => {
    const spec = fixture({ kind: "IMAGE", reason: "Intro" });
    const first = spec.scenes[0].shots[0];
    spec.project.productionMode = "standard";
    spec.scenes[0].shots.push({ ...first, id: "motion_2", visualPlan: { kind: "VIDEO", reason: "Demonstration" } });
    assert.doesNotThrow(() => assertVisualPlanExecutable(spec));
  });

  it("refuses incomplete timelines instead of filtering missing slots", async () => {
    await assert.rejects(compileMixedVisualVideo({ clips: [{ url: "", mediaType: "image", durationSec: 2 }] }), /Every planned visual/);
    await assert.rejects(compileMixedVisualVideo({ clips: [{ url: "https://media.example/a.png", mediaType: "image", durationSec: NaN }] }), /positive duration/);
  });
});

it("mixed compiler preserves all beats, records narration, and releases resources on success and cancellation", async () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const drawn: string[] = [];
  let closed = 0, stopped = 0;
  const track = () => ({ stop() { stopped++; } });
  class Stream {
    tracks = [track()];
    getVideoTracks() { return this.tracks; }
    getAudioTracks() { return this.tracks; }
    getTracks() { return this.tracks; }
    addTrack(t: ReturnType<typeof track>) { this.tracks.push(t); }
  }
  class ImageFixture {
    naturalWidth = 320; naturalHeight = 180; onload?: () => void; srcValue = "";
    set src(value: string) { this.srcValue = value; queueMicrotask(() => this.onload?.()); }
  }
  class MediaFixture {
    duration = .6; videoWidth = 320; videoHeight = 180; currentTime = 0; src = "";
    onloadeddata?: () => void; onloadedmetadata?: () => void;
    load() { queueMicrotask(() => { this.onloadeddata?.(); this.onloadedmetadata?.(); }); }
    play() { return Promise.resolve(); }
    pause() {}
    removeAttribute() {}
  }
  class Recorder {
    static isTypeSupported(type: string) { return type === "video/webm"; }
    state = "inactive"; mimeType = "video/webm";
    ondataavailable?: (e: { data: Blob }) => void; onstop?: () => void;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["recorded fixture"]) }); this.onstop?.(); }); }
  }
  class AudioContextFixture {
    state = "running";
    createMediaStreamDestination() { return { stream: new Stream() }; }
    createMediaElementSource() { return { connect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    async resume() {}
    async close() { closed++; }
  }
  try {
    set("Image", ImageFixture); set("Audio", MediaFixture); set("MediaRecorder", Recorder);
    set("window", { AudioContext: AudioContextFixture });
    set("document", { createElement(type: string) {
      if (type === "video") return new MediaFixture();
      return { captureStream: () => new Stream(), getContext: () => ({ fillRect() {}, drawImage(image: ImageFixture | MediaFixture) { drawn.push(image instanceof ImageFixture ? image.srcValue : "video"); } }) };
    } });
    const clips = [
      { url: "data:image/png,first", mediaType: "image" as const, durationSec: .2 },
      { url: "data:video/mp4,clip", mediaType: "video" as const, durationSec: .2 },
      { url: "data:image/png,last", mediaType: "image" as const, durationSec: .2 },
    ];
    const result = await compileMixedVisualVideo({ clips, audioUrl: "data:audio/wav,narration" });
    assert.equal(result.mimeType, "video/webm"); assert.equal(result.durationSec, .6);
    assert.deepEqual([...new Set(drawn)], ["data:image/png,first", "video", "data:image/png,last"]);
    assert.equal(closed, 1); assert.ok(stopped >= 2);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(compileMixedVisualVideo({ clips, signal: controller.signal }), /cancelled/);
    assert.equal(closed, 2);
  } finally {
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
