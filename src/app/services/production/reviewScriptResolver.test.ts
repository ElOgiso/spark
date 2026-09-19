import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveReviewScript } from "./reviewScriptResolver";

describe("Creative Review Script Resolver", () => {
  it("resolves priority 1: brief.narrativeScript.fullSpokenScript", () => {
    const res = resolveReviewScript({
      brief: {
        narrativeScript: {
          fullSpokenScript: "Hello from fullSpokenScript",
          chapters: [{ order: 1, title: "Intro", durationSec: 5, spoken: "Hello" }],
        },
      },
      production: {
        narrativeScriptObj: { fullSpokenScript: "Lower priority" },
      },
      spark: {
        suggestedScript: "Lowest priority",
      },
    });
    assert.equal(res.fullSpokenScript, "Hello from fullSpokenScript");
    assert.equal(res.chapters.length, 1);
    assert.equal(res.chapters[0].title, "Intro");
    assert.equal(res.source, "narrativeScript.fullSpokenScript");
    assert.equal(res.hasScript, true);
  });

  it("resolves priority 2: join narrativeScript.chapters[].spoken in order", () => {
    const res = resolveReviewScript({
      brief: {
        narrativeScript: {
          chapters: [
            { order: 2, title: "Body", durationSec: 10, spoken: "Second beat spoken" },
            { order: 1, title: "Hook", durationSec: 5, spoken: "First beat spoken" },
          ],
        },
      },
      spark: { suggestedScript: "Lowest priority" },
    });
    assert.equal(res.fullSpokenScript, "First beat spoken\n\nSecond beat spoken");
    assert.equal(res.chapters[0].order, 1);
    assert.equal(res.chapters[1].order, 2);
    assert.equal(res.source, "narrativeScript.chapters");
    assert.equal(res.hasScript, true);
  });

  it("resolves priority 3: production.narrativeScriptObj / spark.narrativeScriptObj", () => {
    const res = resolveReviewScript({
      production: {
        narrativeScriptObj: {
          fullSpokenScript: "Script from production.narrativeScriptObj",
          chapters: [{ order: 1, title: "Solo", spoken: "Script from production.narrativeScriptObj" }],
        },
      },
      spark: { suggestedScript: "Lowest priority" },
    });
    assert.equal(res.fullSpokenScript, "Script from production.narrativeScriptObj");
    assert.equal(res.source, "narrativeScriptObj");
    assert.equal(res.hasScript, true);
  });

  it("resolves priority 4: brief beats spokenLines joined", () => {
    const res = resolveReviewScript({
      brief: {
        beats: [
          { order: 1, title: "Hook", spokenLines: ["Attention founders.", "Listen close."] },
          { order: 2, title: "Climax", spokenLines: "Here is the insight." },
        ],
      },
      spark: { suggestedScript: "Lowest priority" },
    });
    assert.equal(res.fullSpokenScript, "Attention founders. Listen close.\n\nHere is the insight.");
    assert.equal(res.source, "beats");
    assert.equal(res.hasScript, true);
  });

  it("resolves priority 5: spark.suggestedScript", () => {
    const res = resolveReviewScript({
      spark: { suggestedScript: "Raw prose script from spark" },
    });
    assert.equal(res.fullSpokenScript, "Raw prose script from spark");
    assert.equal(res.source, "suggestedScript");
    assert.equal(res.hasScript, true);
  });

  it("handles empty state cleanly when no script exists", () => {
    const res = resolveReviewScript({});
    assert.equal(res.fullSpokenScript, "");
    assert.equal(res.chapters.length, 0);
    assert.equal(res.source, "none");
    assert.equal(res.hasScript, false);
  });
});
