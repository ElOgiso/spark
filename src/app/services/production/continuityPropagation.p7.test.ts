/**
 * Phase 7 — Continuity State & Propagation tests (deterministic, no providers).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  emptyContinuityState,
  type ContinuityState,
} from "./specification/continuitySpec";
import {
  applyContinuityDelta,
  changeFieldDelta,
  emptyDelta,
  transferPropDelta,
} from "./continuity/continuityDelta";
import {
  inheritContinuityLayers,
  resetForSceneTransition,
} from "./continuity/continuityScope";
import { isFieldLocked, lockSubject, withLocks } from "./continuity/continuityLocks";
import {
  propagateContinuitySequence,
  type ContinuityShotStep,
} from "./continuity/continuityPropagation";
import { detectContinuityConflicts } from "./continuity/continuityConflicts";
import { analyzeContinuityImpact } from "./continuity/continuityImpact";
import { assessContinuityRisk } from "./continuity/continuityRisk";
import {
  whereWasCharacterLastSeen,
  whoHoldsProp,
  activeWardrobeVersion,
  characterTravelDirection,
  getStateEnteringShot,
} from "./continuity/continuityQuery";
import {
  buildGenerationHandoff,
  handoffToContinuityRequirements,
} from "./continuity/generationHandoff";
import { deriveConstraintsFromState } from "./continuity/continuityConstraints";

function coffeeShopSeed(): ContinuityState {
  const locks = [
    lockSubject({
      targetKind: "character",
      subjectId: "CHAR_001",
      field: "identity",
      reason: "John identity locked",
      scope: "production",
    }),
    lockSubject({
      targetKind: "wardrobe",
      subjectId: "CHAR_001",
      field: "clothing",
      reason: "blue denim jacket locked for scene",
      scope: "scene",
    }),
  ];

  return withLocks(
    {
      ...emptyContinuityState("Coffee shop open"),
      productionId: "prod_coffee",
      sceneId: "SCENE_01",
      sequenceId: "SEQ_01",
      scope: "scene",
      identity: {
        definingCharacteristics: ["John, mid-30s, warm expression"],
        characterRefs: ["CHAR_001"],
        face: "John face",
        hair: "short brown",
      },
      wardrobe: {
        clothing: "blue denim jacket, white shirt, black trousers, brown boots, silver watch",
        colors: ["blue", "white", "black", "brown"],
        state: "locked",
      },
      location: {
        locationId: "LOC_001",
        environment: "neighborhood coffee shop",
        roomOrArea: "main cafe",
        timeOfDay: "morning",
      },
      lighting: {
        direction: "window key from screen-left",
        color: "warm daylight",
        keySource: "front window",
        time: "morning",
      },
      time: { dayNight: "day", storyTime: "morning", temporalMode: "continuous" },
      spatial: {
        subjectPosition: "entrance",
        screenDirection: "left_to_right",
        cameraRelationship: "observer",
      },
      characters: [
        {
          characterId: "CHAR_001",
          version: 1,
          identity: "John",
          hair: "short brown",
          wardrobe: {
            clothing: "blue denim jacket, white shirt, black trousers, brown boots, silver watch",
            colors: ["blue", "white", "black", "brown"],
          },
          position: "entrance",
          screenDirection: "left_to_right",
          heldPropIds: [],
          lockedFields: ["identity", "clothing"],
          scope: "production",
        },
        {
          characterId: "CHAR_002",
          version: 1,
          identity: "Barista",
          position: "behind_counter",
          heldPropIds: [],
          scope: "scene",
        },
      ],
      props: [],
      products: [],
      axis: {
        axisId: "axis_counter",
        orientation: "counter-line",
        cameraSide: "customer",
        crossingIntent: "none",
      },
      visualTreatmentId: "STYLE_001",
      version: 1,
      source: { kind: "manual", confidence: 1, assumptions: ["seed state"] },
    },
    locks
  );
}

describe("Phase 7 continuity — inheritance", () => {
  it("inherits production → scene → sequence → shot with overrides", () => {
    const production: ContinuityState = {
      ...emptyContinuityState("prod"),
      visualTreatmentId: "STYLE_001",
      identity: { definingCharacteristics: ["John"], characterRefs: ["CHAR_001"] },
      scope: "production",
    };
    const scene: ContinuityState = {
      ...emptyContinuityState("scene"),
      location: { locationId: "LOC_001", environment: "cafe" },
      wardrobe: { clothing: "blue denim jacket" },
      scope: "scene",
    };
    const sequence: ContinuityState = {
      ...emptyContinuityState("seq"),
      props: [{ propId: "PROP_004", identity: "latte cup", holderId: null, position: "counter" }],
      scope: "sequence",
    };
    const shot: ContinuityState = {
      ...emptyContinuityState("shot"),
      spatial: { subjectPosition: "at_counter", screenDirection: "left_to_right" },
      cameraState: "medium closeup",
      scope: "shot",
    };

    const merged = inheritContinuityLayers({ production, scene, sequence, shot });
    assert.equal(merged.visualTreatmentId, "STYLE_001");
    assert.equal(merged.location.locationId, "LOC_001");
    assert.equal(merged.wardrobe.clothing, "blue denim jacket");
    assert.equal(merged.props[0]?.propId, "PROP_004");
    assert.equal(merged.spatial.subjectPosition, "at_counter");
    assert.equal(merged.cameraState, "medium closeup");
  });
});

describe("Phase 7 continuity — delta application", () => {
  it("applies state A + delta = state B", () => {
    const a = coffeeShopSeed();
    const delta = changeFieldDelta({
      fromShotId: "SHOT_01",
      toShotId: "SHOT_02",
      path: "characters.CHAR_001.position",
      from: "entrance",
      to: "approaching_counter",
      changeKind: "derived",
      summary: "John approaches counter",
    });
    const b = applyContinuityDelta(a, delta);
    const john = b.characters!.find((c) => c.characterId === "CHAR_001")!;
    assert.equal(john.position, "approaching_counter");
    assert.equal(b.shotId, "SHOT_02");
  });

  it("transfers prop ownership to John and syncs heldPropIds", () => {
    let state = coffeeShopSeed();
    state.props = [
      {
        propId: "PROP_004",
        identity: "latte cup",
        holderId: "CHAR_002",
        position: "counter",
        visibility: "visible",
      },
    ];
    state.characters = (state.characters || []).map((c) =>
      c.characterId === "CHAR_002" ? { ...c, heldPropIds: ["PROP_004"] } : c
    );

    const delta = transferPropDelta({
      fromShotId: "SHOT_04",
      toShotId: "SHOT_05",
      propId: "PROP_004",
      fromHolderId: "CHAR_002",
      toHolderId: "CHAR_001",
      reason: "barista hands cup to John",
    });
    state = applyContinuityDelta(state, delta);
    assert.equal(state.props.find((p) => p.propId === "PROP_004")?.holderId, "CHAR_001");
    const john = state.characters!.find((c) => c.characterId === "CHAR_001")!;
    assert.ok(john.heldPropIds?.includes("PROP_004"));
  });
});

describe("Phase 7 continuity — locks", () => {
  it("blocks implicit wardrobe mutation when locked", () => {
    const state = coffeeShopSeed();
    assert.equal(isFieldLocked(state.locks, "CHAR_001", "clothing"), true);
    const delta = changeFieldDelta({
      toShotId: "SHOT_06",
      path: "wardrobe.clothing",
      from: state.wardrobe.clothing,
      to: "red jacket",
      changeKind: "derived",
    });
    assert.throws(() => applyContinuityDelta(state, delta), /Locked|locked|cannot mutate/i);
  });
});

describe("Phase 7 continuity — coffee shop acceptance", () => {
  it("propagates expected state through SHOT_01..SHOT_08", () => {
    const seed = coffeeShopSeed();
    seed.props = [
      {
        propId: "PROP_004",
        identity: "latte cup",
        holderId: null,
        position: "counter",
        visibility: "visible",
      },
    ];

    const steps: ContinuityShotStep[] = [
      {
        shotId: "SHOT_01",
        sceneId: "SCENE_01",
        summary: "John enters coffee shop. Empty hands. Walking left → right.",
        delta: changeFieldDelta({
          toShotId: "SHOT_01",
          path: "characters.CHAR_001.position",
          to: "entrance",
          changeKind: "planned",
          summary: "John enters",
        }),
        declaredState: {
          spatial: {
            ...seed.spatial,
            subjectPosition: "entrance",
            screenDirection: "left_to_right",
          },
          actionPhase: "entering",
        },
      },
      {
        shotId: "SHOT_02",
        sceneId: "SCENE_01",
        summary: "John approaches counter. Empty hands. Same wardrobe.",
        delta: changeFieldDelta({
          fromShotId: "SHOT_01",
          toShotId: "SHOT_02",
          path: "characters.CHAR_001.position",
          from: "entrance",
          to: "approaching_counter",
          changeKind: "derived",
        }),
      },
      {
        shotId: "SHOT_03",
        sceneId: "SCENE_01",
        summary: "John orders latte. Looks toward barista.",
        delta: {
          ...emptyDelta("SHOT_03", "orders latte"),
          fromShotId: "SHOT_02",
          intentional: true,
          changed: [
            {
              path: "characters.CHAR_001.gazeTarget",
              to: "CHAR_002",
              changeKind: "intentional",
              reason: "looks toward barista",
            },
            {
              path: "characters.CHAR_001.gazeDirection",
              to: "screen_right",
              changeKind: "intentional",
            },
            {
              path: "characters.CHAR_001.position",
              to: "at_counter",
              changeKind: "derived",
            },
          ],
        },
      },
      {
        shotId: "SHOT_04",
        sceneId: "SCENE_01",
        summary: "Barista prepares coffee. Cup is on counter.",
        delta: {
          ...emptyDelta("SHOT_04", "cup on counter"),
          fromShotId: "SHOT_03",
          intentional: true,
          changed: [
            { path: "props.PROP_004.holderId", to: null, changeKind: "intentional" },
            { path: "props.PROP_004.position", to: "counter", changeKind: "intentional" },
          ],
        },
      },
      {
        shotId: "SHOT_05",
        sceneId: "SCENE_01",
        summary: "Barista hands cup to John.",
        delta: transferPropDelta({
          fromShotId: "SHOT_04",
          toShotId: "SHOT_05",
          propId: "PROP_004",
          fromHolderId: null,
          toHolderId: "CHAR_001",
          reason: "barista hands cup to John",
        }),
      },
      {
        shotId: "SHOT_06",
        sceneId: "SCENE_01",
        summary: "John walks toward window. Cup in right hand. Same screen direction.",
        delta: {
          ...emptyDelta("SHOT_06", "walks to window"),
          fromShotId: "SHOT_05",
          changed: [
            {
              path: "characters.CHAR_001.position",
              to: "toward_window",
              changeKind: "derived",
            },
            {
              path: "spatial.subjectPosition",
              to: "toward_window",
              changeKind: "derived",
            },
          ],
        },
      },
      {
        shotId: "SHOT_07",
        sceneId: "SCENE_01",
        summary: "John sits. Cup remains with John.",
        delta: changeFieldDelta({
          fromShotId: "SHOT_06",
          toShotId: "SHOT_07",
          path: "characters.CHAR_001.position",
          to: "seated_by_window",
          changeKind: "derived",
        }),
      },
      {
        shotId: "SHOT_08",
        sceneId: "SCENE_01",
        summary: "John drinks.",
        delta: changeFieldDelta({
          fromShotId: "SHOT_07",
          toShotId: "SHOT_08",
          path: "actionPhase",
          to: "drinking",
          changeKind: "intentional",
          intentional: true,
          summary: "John drinks",
        }),
      },
    ];

    const result = propagateContinuitySequence(seed, steps);
    assert.equal(result.bridges.length, 8);

    const out5 = result.bridges.find((b) => b.shotId === "SHOT_05")!.continuityOut;
    assert.equal(whoHoldsProp(out5, "PROP_004")?.holderId, "CHAR_001");

    const out8 = result.bridges.find((b) => b.shotId === "SHOT_08")!.continuityOut;
    assert.equal(whoHoldsProp(out8, "PROP_004")?.holderId, "CHAR_001");
    assert.equal(activeWardrobeVersion(out8, "CHAR_001")?.clothing?.includes("blue denim"), true);
    assert.equal(characterTravelDirection(out8, "CHAR_001"), "left_to_right");
    assert.equal(out8.location.locationId, "LOC_001");
    assert.equal(out8.visualTreatmentId, "STYLE_001");

    const lastSeen = whereWasCharacterLastSeen(result.bridges, "CHAR_001");
    assert.equal(lastSeen?.shotId, "SHOT_08");

    const entering6 = getStateEnteringShot(result.bridges, "SHOT_06");
    assert.equal(whoHoldsProp(entering6!, "PROP_004")?.holderId, "CHAR_001");

    const bridge6 = result.bridges.find((b) => b.shotId === "SHOT_06")!;
    assert.ok(bridge6.generationHandoff);
    const reqs = handoffToContinuityRequirements(bridge6.generationHandoff!);
    assert.ok(reqs.requiredContinuity.some((r) => /jacket|wardrobe|PROP_004|left_to_right|John|cup/i.test(r)));
  });

  it("flags missing cup at SHOT_06 as expected-state inconsistency", () => {
    const expected = coffeeShopSeed();
    expected.props = [
      { propId: "PROP_004", identity: "latte cup", holderId: "CHAR_001", position: "right_hand" },
    ];
    expected.characters = (expected.characters || []).map((c) =>
      c.characterId === "CHAR_001" ? { ...c, heldPropIds: ["PROP_004"] } : c
    );

    const observed: ContinuityState = {
      ...structuredClone(expected),
      props: [],
      characters: (expected.characters || []).map((c) =>
        c.characterId === "CHAR_001" ? { ...c, heldPropIds: [] } : c
      ),
      shotId: "SHOT_06",
    };

    const conflicts = detectContinuityConflicts({
      expected,
      observed,
      shotId: "SHOT_06",
    });
    assert.ok(conflicts.some((c) => c.classification === "hard" && c.category === "PROP"));
  });

  it("flags locked wardrobe change to red jacket", () => {
    const expected = coffeeShopSeed();
    const observed: ContinuityState = {
      ...structuredClone(expected),
      wardrobe: { ...expected.wardrobe, clothing: "red jacket" },
      characters: (expected.characters || []).map((c) =>
        c.characterId === "CHAR_001"
          ? { ...c, wardrobe: { ...(c.wardrobe || {}), clothing: "red jacket" } }
          : c
      ),
      shotId: "SHOT_06",
    };
    const conflicts = detectContinuityConflicts({
      expected,
      observed,
      shotId: "SHOT_06",
    });
    assert.ok(conflicts.some((c) => c.classification === "hard" && c.category === "WARDROBE"));
  });

  it("flags unplanned screen-direction reverse; allows intentional reverse", () => {
    const expected = coffeeShopSeed();
    const observed: ContinuityState = {
      ...structuredClone(expected),
      spatial: { ...expected.spatial, screenDirection: "right_to_left" },
      characters: (expected.characters || []).map((c) =>
        c.characterId === "CHAR_001" ? { ...c, screenDirection: "right_to_left" } : c
      ),
      shotId: "SHOT_07",
    };

    const unplanned = detectContinuityConflicts({ expected, observed, shotId: "SHOT_07" });
    assert.ok(unplanned.some((c) => c.classification === "hard" && c.category === "SCREEN_DIRECTION"));

    const intentional = detectContinuityConflicts({
      expected,
      observed,
      shotId: "SHOT_07",
      screenDirectionChange: { intentional: true, reason: "character turns around" },
    });
    assert.ok(
      intentional.some((c) => c.classification === "intentional" && c.category === "SCREEN_DIRECTION")
    );
  });
});

describe("Phase 7 continuity — cross-scene scope", () => {
  it("resets sequence props at scene boundary unless carried", () => {
    const state = coffeeShopSeed();
    state.props = [{ propId: "PROP_004", identity: "latte cup", holderId: "CHAR_001" }];
    state.characters = (state.characters || []).map((c) =>
      c.characterId === "CHAR_001" ? { ...c, heldPropIds: ["PROP_004"], position: "seated" } : c
    );

    const reset = resetForSceneTransition(state, "SCENE_02");
    assert.equal(reset.props.length, 0);
    assert.equal(reset.characters![0].heldPropIds?.length, 0);
    assert.equal(reset.location.locationId, "LOC_001");
    assert.equal(reset.wardrobe.clothing?.includes("blue denim"), true);

    const carried = resetForSceneTransition(state, "SCENE_02", {
      carryProps: true,
      carryScreenDirection: true,
      temporalDiscontinuity: "time_jump",
    });
    assert.equal(carried.props.length, 1);
    assert.equal(carried.time.temporalMode, "time_jump");
    assert.equal(carried.spatial.screenDirection, "left_to_right");
  });
});

describe("Phase 7 continuity — impact + risk + generation", () => {
  it("identifies downstream shots impacted by wardrobe version change", () => {
    const seed = coffeeShopSeed();
    const result = propagateContinuitySequence(seed, [
      { shotId: "SHOT_01", sceneId: "SCENE_01", summary: "s1", delta: emptyDelta("SHOT_01", "s1") },
      { shotId: "SHOT_02", sceneId: "SCENE_01", summary: "s2", delta: emptyDelta("SHOT_02", "s2") },
      { shotId: "SHOT_03", sceneId: "SCENE_01", summary: "s3", delta: emptyDelta("SHOT_03", "s3") },
      { shotId: "SHOT_04", sceneId: "SCENE_01", summary: "s4", delta: emptyDelta("SHOT_04", "s4") },
    ]);

    const impact = analyzeContinuityImpact({
      bridges: result.bridges,
      changedShotId: "SHOT_01",
      subjectId: "CHAR_001",
      field: "wardrobe.clothing",
      fromVersion: 1,
      toVersion: 2,
    });
    assert.ok(impact.affectedShotIds.includes("SHOT_02"));
    assert.ok(impact.affectedShotIds.includes("SHOT_03"));
    assert.ok(impact.affectedShotIds.includes("SHOT_04"));
  });

  it("scores high risk for prop handoff + movement + axis change", () => {
    const continuityIn = coffeeShopSeed();
    const continuityOut: ContinuityState = {
      ...structuredClone(continuityIn),
      props: [{ propId: "PROP_004", identity: "cup", holderId: "CHAR_001" }],
      characters: (continuityIn.characters || []).map((c) =>
        c.characterId === "CHAR_001" ? { ...c, position: "window", heldPropIds: ["PROP_004"] } : c
      ),
      axis: { ...continuityIn.axis!, cameraSide: "service" },
      interactions: [
        { subjectId: "CHAR_001", verb: "holds", objectId: "PROP_004", kind: "character_prop" },
      ],
    };
    const risk = assessContinuityRisk({
      shotId: "SHOT_05",
      continuityIn,
      continuityOut,
      delta: transferPropDelta({
        fromShotId: "SHOT_04",
        toShotId: "SHOT_05",
        propId: "PROP_004",
        fromHolderId: null,
        toHolderId: "CHAR_001",
      }),
    });
    assert.equal(risk.level, "high");
    assert.ok(risk.reasons.some((r) => /handoff|movement|axis|interaction/i.test(r)));
  });

  it("builds generation handoff with required vs optional continuity", () => {
    const state = coffeeShopSeed();
    state.props = [{ propId: "PROP_004", identity: "cup", holderId: "CHAR_001" }];
    state.characters = (state.characters || []).map((c) =>
      c.characterId === "CHAR_001" ? { ...c, heldPropIds: ["PROP_004"], position: "counter" } : c
    );
    const constraints = deriveConstraintsFromState(state, "SHOT_06");
    const risk = assessContinuityRisk({
      shotId: "SHOT_06",
      continuityIn: state,
      continuityOut: state,
    });
    const handoff = buildGenerationHandoff({
      shotId: "SHOT_06",
      sceneId: "SCENE_01",
      continuityIn: state,
      continuityOut: state,
      requiredConstraints: constraints.required,
      optionalConstraints: constraints.optional,
      risk,
    });
    assert.ok(handoff.requiredConstraints.length > 0);
    assert.ok(handoff.forbiddenChanges.some((f) => /CHAR_001|clothing/i.test(f)));
    const flat = handoffToContinuityRequirements(handoff);
    assert.ok(flat.requiredContinuity.length >= 1);
  });
});
