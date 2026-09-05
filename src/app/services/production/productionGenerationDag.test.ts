/**
 * SPARK Generation DAG + parallel/sequential execution (Phase 8).
 * Deterministic unit tests — no provider calls.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { GenerationTask, TaskDependency } from "./specification/generationTask";
import { syncDependsOn } from "./specification/generationTask";
import { strategyFromAlias } from "./specification/generationStrategy";
import {
  buildProductionDagFromTasks,
  readyNodes,
  markNode,
  approveNode,
  validateProductionDag,
  computeExecutionWaves,
  computeCriticalPath,
  propagateFailure,
  planRetry,
  applyRetry,
  cancelNode,
  createCheckpoint,
  resumeFromCheckpoint,
  explainBlocked,
  dependentTaskIds,
} from "./dag/productionDag";
import { selectReadyBatch, DEFAULT_SCHEDULER_CONFIG } from "./execution/scheduler";

function edge(
  taskId: string,
  reason: TaskDependency["reason"],
  strength: TaskDependency["strength"] = "hard",
  requirement: TaskDependency["requirement"] = "completed"
): TaskDependency {
  return { taskId, reason, strength, requirement };
}

function task(
  id: string,
  kind: GenerationTask["kind"],
  deps: TaskDependency[] = [],
  extra: Partial<GenerationTask> = {}
): GenerationTask {
  const alias =
    kind === "video"
      ? "image_to_video"
      : kind === "voice"
        ? "voice"
        : kind === "merge"
          ? "mux_edit"
          : "text_to_image";
  return syncDependsOn({
    id,
    kind,
    productionId: "prod_test",
    strategy: strategyFromAlias(alias as "text_to_image"),
    requiredCapabilities: [],
    dependsOn: [],
    dependencies: deps,
    status: deps.some((d) => d.strength === "hard") ? "blocked" : "queued",
    maxRetries: 2,
    ...extra,
  });
}

describe("Generation DAG — construction & validation", () => {
  it("builds nodes from tasks", () => {
    const tasks = [
      task("CHAR_REF", "keyframe"),
      task("SHOT_01", "video", [edge("CHAR_REF", "REFERENCE")]),
    ];
    const dag = buildProductionDagFromTasks("prod_test", tasks);
    assert.equal(dag.nodes.length, 2);
    assert.deepEqual(dag.nodes.find((n) => n.id === "SHOT_01")!.dependsOn, ["CHAR_REF"]);
    assert.equal(validateProductionDag(dag).ok, true);
  });

  it("rejects missing dependency, duplicate id, self-dependency, and cycles", () => {
    const missing = buildProductionDagFromTasks("p", [
      task("B", "video", [edge("A", "ASSET")]),
    ]);
    assert.equal(validateProductionDag(missing).ok, false);
    assert.ok(validateProductionDag(missing).issues.some((i) => i.code === "missing_dependency"));

    const dup = buildProductionDagFromTasks("p", [task("A", "keyframe"), task("A", "keyframe")]);
    assert.ok(validateProductionDag(dup).issues.some((i) => i.code === "duplicate_id"));

    const self = buildProductionDagFromTasks("p", [
      syncDependsOn({
        ...task("A", "keyframe"),
        dependsOn: ["A"],
        dependencies: [edge("A", "SEQUENTIAL")],
      }),
    ]);
    assert.ok(validateProductionDag(self).issues.some((i) => i.code === "self_dependency"));

    const cycle = buildProductionDagFromTasks("p", [
      task("A", "keyframe", [edge("C", "SEQUENTIAL")]),
      task("B", "keyframe", [edge("A", "SEQUENTIAL")]),
      task("C", "keyframe", [edge("B", "SEQUENTIAL")]),
    ]);
    assert.ok(validateProductionDag(cycle).issues.some((i) => i.code === "cycle"));
  });
});

describe("Generation DAG — ready resolution & parallelism", () => {
  it("A done → B depending on A becomes ready", () => {
    let dag = buildProductionDagFromTasks("p", [
      task("A", "keyframe"),
      task("B", "video", [edge("A", "ASSET")]),
    ]);
    assert.deepEqual(
      readyNodes(dag).map((n) => n.id),
      ["A"]
    );
    dag = markNode(dag, "A", "done");
    assert.deepEqual(
      readyNodes(dag).map((n) => n.id),
      ["B"]
    );
  });

  it("independent A and B are ready simultaneously", () => {
    const dag = buildProductionDagFromTasks("p", [task("A", "keyframe"), task("B", "keyframe")]);
    assert.deepEqual(readyNodes(dag).map((n) => n.id).sort(), ["A", "B"]);
  });

  it("sequential continuity requires approved_output", () => {
    const dag = buildProductionDagFromTasks("p", [
      task("A", "video"),
      task("B", "video", [edge("A", "CONTINUITY", "hard", "approved_output")]),
    ]);
    assert.ok(!readyNodes(dag).some((n) => n.id === "B"));
    let next = markNode(dag, "A", "done");
    assert.ok(!readyNodes(next).some((n) => n.id === "B"));
    next = approveNode(next, "A");
    assert.ok(readyNodes(next).some((n) => n.id === "B"));
  });
});

describe("Generation DAG — continuity vs independent shots", () => {
  it("SHOT_02 requiring SHOT_01 creates CONTINUITY dependency", () => {
    const dag = buildProductionDagFromTasks("p", [
      task("SHOT_01_video", "video"),
      task("SHOT_02_video", "video", [
        edge("SHOT_01_video", "CONTINUITY", "hard", "approved_output"),
      ]),
    ]);
    const n = dag.nodes.find((x) => x.id === "SHOT_02_video")!;
    assert.ok(n.dependencies.some((d) => d.reason === "CONTINUITY"));
  });

  it("independent SHOT_02 and SHOT_03 can both become ready", () => {
    const dag = buildProductionDagFromTasks("p", [
      task("SHOT_02_video", "video"),
      task("SHOT_03_video", "video"),
    ]);
    assert.deepEqual(readyNodes(dag).map((n) => n.id).sort(), [
      "SHOT_02_video",
      "SHOT_03_video",
    ]);
  });
});

describe("Generation DAG — failure, retry, cancel, resume, idempotency", () => {
  it("failure blocks dependents but not independents", () => {
    let dag = buildProductionDagFromTasks("p", [
      task("SHOT_01", "video"),
      task("SHOT_02", "video", [edge("SHOT_01", "CONTINUITY")]),
      task("SHOT_03", "video", [edge("SHOT_02", "CONTINUITY")]),
      task("SHOT_04", "video"),
    ]);
    dag = markNode(dag, "SHOT_01", "done");
    const prop = propagateFailure(dag, "SHOT_02");
    assert.equal(prop.dag.nodes.find((n) => n.id === "SHOT_02")!.status, "failed");
    assert.ok(prop.blockedIds.includes("SHOT_03"));
    assert.ok(prop.independentIds.includes("SHOT_04"));
    assert.equal(prop.dag.nodes.find((n) => n.id === "SHOT_04")!.status, "ready");
  });

  it("retry failed task then dependent becomes ready", () => {
    let dag = buildProductionDagFromTasks("p", [
      task("A", "video"),
      task("B", "video", [edge("A", "CONTINUITY")]),
    ]);
    dag = propagateFailure(dag, "A").dag;
    assert.equal(dag.nodes.find((n) => n.id === "B")!.status, "blocked");
    const plan = planRetry(dag, "A", "affected_descendants");
    dag = applyRetry(dag, plan);
    assert.ok(readyNodes(dag).some((n) => n.id === "A"));
    dag = markNode(dag, "A", "done");
    assert.ok(readyNodes(dag).some((n) => n.id === "B"));
  });

  it("resume preserves completed tasks", () => {
    let dag = buildProductionDagFromTasks("p", [
      task("A", "keyframe"),
      task("B", "video", [edge("A", "ASSET")]),
      task("C", "video"),
    ]);
    dag = markNode(dag, "A", "done");
    dag = markNode(dag, "C", "done");
    dag = markNode(dag, "B", "running");
    const cp = createCheckpoint(dag, "generation_wave_complete");
    const resumed = resumeFromCheckpoint(dag, cp);
    assert.equal(resumed.nodes.find((n) => n.id === "A")!.status, "done");
    assert.equal(resumed.nodes.find((n) => n.id === "C")!.status, "done");
    assert.notEqual(resumed.nodes.find((n) => n.id === "B")!.status, "done");
  });

  it("idempotent: completed task is not selected again", () => {
    const tasks = [
      { ...task("A", "keyframe"), status: "succeeded" as const },
      task("B", "keyframe"),
    ];
    const dag = buildProductionDagFromTasks("p", tasks);
    const batch = selectReadyBatch({
      dag,
      tasks,
      runningTaskIds: new Set(),
      config: DEFAULT_SCHEDULER_CONFIG,
    });
    assert.ok(!batch.taskIds.includes("A"));
    assert.ok(batch.taskIds.includes("B"));
  });

  it("cancel propagates to dependents only", () => {
    let dag = buildProductionDagFromTasks("p", [
      task("A", "video"),
      task("B", "video", [edge("A", "CONTINUITY")]),
      task("C", "video"),
    ]);
    dag = cancelNode(dag, "A", { descendants: true });
    assert.equal(dag.nodes.find((n) => n.id === "A")!.status, "cancelled");
    assert.equal(dag.nodes.find((n) => n.id === "B")!.status, "cancelled");
    assert.notEqual(dag.nodes.find((n) => n.id === "C")!.status, "cancelled");
  });
});

describe("Generation DAG — waves, critical path, concurrency", () => {
  it("integration waves: refs → parallel shots → continuity chain", () => {
    const tasks = [
      task("CHARACTER_REFERENCE", "keyframe", [], { priority: "CRITICAL" }),
      task("LOCATION_REFERENCE", "keyframe", [], { priority: "CRITICAL" }),
      task("SHOT_01", "video", [edge("CHARACTER_REFERENCE", "REFERENCE")]),
      task("SHOT_02", "video", [edge("SHOT_01", "CONTINUITY", "hard", "approved_output")]),
      task("SHOT_03", "video", [edge("SHOT_02", "CONTINUITY", "hard", "approved_output")]),
      task("SHOT_04", "video", [edge("LOCATION_REFERENCE", "REFERENCE")]),
      task("SHOT_05", "video", [edge("LOCATION_REFERENCE", "REFERENCE")]),
      task("SHOT_06", "video", [edge("LOCATION_REFERENCE", "REFERENCE")]),
    ];
    const dag = buildProductionDagFromTasks("p", tasks);
    const waves = computeExecutionWaves(dag);
    assert.ok(waves.length >= 4);
    assert.deepEqual(waves[0]!.taskIds.sort(), ["CHARACTER_REFERENCE", "LOCATION_REFERENCE"]);
    for (const id of ["SHOT_01", "SHOT_04", "SHOT_05", "SHOT_06"]) {
      assert.ok(waves[1]!.taskIds.includes(id));
    }
    assert.deepEqual(waves[2]!.taskIds, ["SHOT_02"]);
    assert.deepEqual(waves[3]!.taskIds, ["SHOT_03"]);
  });

  it("adding SHOT_04→SHOT_05 does not serialize SHOT_01/SHOT_06", () => {
    const tasks = [
      task("CHARACTER_REFERENCE", "keyframe"),
      task("LOCATION_REFERENCE", "keyframe"),
      task("SHOT_01", "video", [edge("CHARACTER_REFERENCE", "REFERENCE")]),
      task("SHOT_04", "video", [edge("LOCATION_REFERENCE", "REFERENCE")]),
      task("SHOT_05", "video", [
        edge("LOCATION_REFERENCE", "REFERENCE"),
        edge("SHOT_04", "CONTINUITY"),
      ]),
      task("SHOT_06", "video", [edge("LOCATION_REFERENCE", "REFERENCE")]),
    ];
    let dag = buildProductionDagFromTasks("p", tasks);
    dag = markNode(dag, "CHARACTER_REFERENCE", "done");
    dag = markNode(dag, "LOCATION_REFERENCE", "done");
    const ready = readyNodes(dag).map((n) => n.id).sort();
    assert.ok(ready.includes("SHOT_01"));
    assert.ok(ready.includes("SHOT_04"));
    assert.ok(ready.includes("SHOT_06"));
    assert.ok(!ready.includes("SHOT_05"));
  });

  it("critical path prefers longest dependency chain", () => {
    const dag = buildProductionDagFromTasks("p", [
      task("CHAR", "keyframe"),
      task("S1", "video", [edge("CHAR", "REFERENCE")]),
      task("S2", "video", [edge("S1", "CONTINUITY")]),
      task("S3", "video", [edge("S2", "CONTINUITY")]),
      task("IND", "video"),
    ]);
    const cp = computeCriticalPath(dag);
    assert.ok(cp.length >= 4);
    assert.ok(cp.path.includes("CHAR"));
    assert.ok(cp.path.includes("S3"));
  });

  it("scheduler never exceeds maxConcurrency", () => {
    const tasks = [task("a", "keyframe"), task("b", "keyframe"), task("c", "keyframe"), task("d", "keyframe")];
    const dag = buildProductionDagFromTasks("p", tasks);
    const batch = selectReadyBatch({
      dag,
      tasks,
      runningTaskIds: new Set(),
      config: { ...DEFAULT_SCHEDULER_CONFIG, maxConcurrency: 2 },
    });
    assert.ok(batch.taskIds.length <= 2);
  });

  it("explainBlocked surfaces CONTINUITY wait reason", () => {
    const dag = buildProductionDagFromTasks("p", [
      task("SHOT_11", "video"),
      task("SHOT_12", "video", [edge("SHOT_11", "CONTINUITY", "hard", "approved_output")]),
    ]);
    const explanation = explainBlocked(dag, "SHOT_12");
    assert.ok(explanation.waitingOn.some((w) => w.reason === "CONTINUITY"));
  });

  it("dependentTaskIds walks forward", () => {
    const dag = buildProductionDagFromTasks("p", [
      task("A", "video"),
      task("B", "video", [edge("A", "CONTINUITY")]),
      task("C", "video", [edge("B", "CONTINUITY")]),
    ]);
    const deps = dependentTaskIds(dag, "A");
    assert.ok(deps.includes("A") && deps.includes("B") && deps.includes("C"));
  });
});

describe("Generation DAG — large production stress", () => {
  it("20+ shots with parallel branches, failure, retry, cancel — no deadlock", () => {
    const tasks: GenerationTask[] = [
      task("CHAR_REF", "keyframe", [], { priority: "CRITICAL" }),
      task("LOC_REF", "keyframe", [], { priority: "CRITICAL" }),
    ];
    for (let i = 1; i <= 8; i++) {
      const deps: TaskDependency[] =
        i === 1
          ? [edge("CHAR_REF", "REFERENCE")]
          : [edge(`A${i - 1}`, "CONTINUITY", "hard", "approved_output")];
      tasks.push(task(`A${i}`, "video", deps));
    }
    for (let i = 1; i <= 10; i++) {
      tasks.push(task(`B${i}`, "video", [edge("LOC_REF", "REFERENCE")]));
    }
    tasks.push(task("C1", "video", [edge("LOC_REF", "REFERENCE")]));
    tasks.push(task("C2", "video", [edge("C1", "CONTINUITY")]));
    tasks.push(task("C3", "video", [edge("C2", "CONTINUITY")]));
    tasks.push(task("C4", "video"));
    tasks.push(
      task(
        "MERGE",
        "merge",
        tasks.filter((t) => t.kind === "video").map((t) => edge(t.id, "EDITORIAL"))
      )
    );

    let dag = buildProductionDagFromTasks("large", tasks);
    assert.equal(validateProductionDag(dag).ok, true);
    assert.ok(tasks.length >= 20);

    dag = markNode(dag, "CHAR_REF", "done");
    dag = markNode(dag, "LOC_REF", "done");
    dag = markNode(dag, "A1", "done");
    dag = approveNode(dag, "A1");
    const prop = propagateFailure(dag, "A2");
    dag = prop.dag;
    assert.ok(prop.blockedIds.includes("A3"));
    assert.ok(prop.independentIds.includes("B1"));

    dag = applyRetry(dag, planRetry(dag, "A2", "affected_descendants"));
    dag = markNode(dag, "A2", "done");
    dag = approveNode(dag, "A2");
    assert.ok(readyNodes(dag).some((n) => n.id === "A3"));

    dag = cancelNode(dag, "C4", { descendants: false });
    assert.equal(dag.nodes.find((n) => n.id === "C4")!.status, "cancelled");
    assert.ok(readyNodes(dag).filter((n) => n.id.startsWith("B")).length >= 5);
  });
});
