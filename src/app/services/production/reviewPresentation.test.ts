import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReviewProductionView,
  formatEditRequestNote,
  statusLabel,
} from "./reviewPresentation";

describe("reviewPresentation — production review intelligence", () => {
  it("orders primary media ahead of storyboard-only artifacts", () => {
    const view = buildReviewProductionView({
      id: "prod-1",
      title: "Launch Film",
      status: "Ready for Review",
      videoUrl: "https://cdn.example.com/master.mp4",
      storyboardUrl: "https://cdn.example.com/board.png",
      productionScenes: [
        {
          id: "scene-1",
          title: "Scene 01",
          shots: [
            {
              id: "shot-1",
              title: "Shot 01",
              purpose: "Establish the product",
              storyboardUrl: "https://cdn.example.com/sb1.png",
              videoUrl: "https://cdn.example.com/shot1.mp4",
            },
          ],
        },
      ],
    });

    assert.equal(view.primaryMediaType, "video");
    assert.equal(view.primaryMediaUrl, "https://cdn.example.com/master.mp4");
    assert.equal(view.shots[0]?.storyboardFrameUrl, "https://cdn.example.com/sb1.png");
    assert.equal(view.shots[0]?.generatedResultUrl, "https://cdn.example.com/shot1.mp4");
    assert.notEqual(view.shots[0]?.storyboardFrameUrl, view.shots[0]?.generatedResultUrl);
  });

  it("keeps storyboard frame, generated result, and state frame distinct", () => {
    const view = buildReviewProductionView({
      id: "prod-2",
      title: "Continuity Cut",
      productionScenes: [
        {
          id: "scene-2",
          shots: [
            {
              id: "shot-3",
              storyboardFrameUrl: "https://cdn.example.com/storyboard.png",
              generatedUrl: "https://cdn.example.com/generated.mp4",
              generatedStateFrameUrl: "https://cdn.example.com/state.png",
              endFrameUrl: "https://cdn.example.com/should-not-override-storyboard.png",
            },
          ],
        },
      ],
    });
    const shot = view.shots[0];
    assert.equal(shot.storyboardFrameUrl, "https://cdn.example.com/storyboard.png");
    assert.equal(shot.generatedResultUrl, "https://cdn.example.com/generated.mp4");
    assert.equal(shot.generatedStateFrameUrl, "https://cdn.example.com/state.png");
  });

  it("does not invent QC passes when analysis is missing", () => {
    const view = buildReviewProductionView({
      id: "prod-3",
      title: "No QC yet",
      productionScenes: [{ id: "scene-1", shots: [{ id: "shot-1", title: "Shot" }] }],
    });
    assert.ok(view.shots[0].qcChecks.length > 0);
    assert.ok(view.shots[0].qcChecks.every((check) => check.status === "not_evaluated"));
    assert.equal(statusLabel("not_evaluated"), "Not evaluated");
    assert.equal(view.shots[0].actual.duration, "Not analyzed");
  });

  it("surfaces intended vs actual separately", () => {
    const view = buildReviewProductionView({
      id: "prod-4",
      title: "Intended Actual",
      productionScenes: [
        {
          id: "scene-1",
          shots: [
            {
              id: "shot-1",
              purpose: "Reveal entrance",
              framing: "medium wide",
              cameraMove: "slow push-in",
              analysis: {
                observed: {
                  framing: "tight close-up",
                  movement: "static",
                  durationSec: 3.2,
                },
              },
            },
          ],
        },
      ],
    });
    const shot = view.shots[0];
    assert.equal(shot.intended.purpose, "Reveal entrance");
    assert.equal(shot.intended.framing, "medium wide");
    assert.equal(shot.actual.framing, "tight close-up");
    assert.equal(shot.actual.observedMovement, "static");
    assert.equal(shot.actual.duration, "3.2");
  });

  it("selects candidate from canonical selectedCandidateId", () => {
    const view = buildReviewProductionView({
      id: "prod-5",
      title: "Candidates",
      productionScenes: [
        {
          id: "scene-1",
          shots: [
            {
              id: "shot-1",
              selectedCandidateId: "cand-b",
              candidates: [
                { id: "cand-a", label: "Candidate A", url: "https://cdn.example.com/a.mp4", selected: true },
                { id: "cand-b", label: "Candidate B", url: "https://cdn.example.com/b.mp4" },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(view.shots[0].selectedCandidateId, "cand-b");
    assert.equal(view.shots[0].candidates.find((c) => c.id === "cand-b")?.selected, true);
    assert.equal(view.shots[0].candidates.find((c) => c.id === "cand-a")?.selected, false);
    assert.equal(view.shots[0].generatedResultUrl, "https://cdn.example.com/b.mp4");
  });

  it("formats edit request notes for regeneration input", () => {
    const note = formatEditRequestNote(["Camera", "Continuity"], "Keep character screen-right.");
    assert.match(note, /Categories: Camera, Continuity/);
    assert.match(note, /Keep character screen-right/);
  });

  it("blocks publish when policy requires approval and user has not approved", () => {
    const view = buildReviewProductionView(
      {
        id: "prod-6",
        title: "Gate",
        status: "Ready for Review",
        videoUrl: "https://cdn.example.com/master.mp4",
        automationMode: "manual",
        publishRequiresApproval: true,
        platform: "youtube",
      },
      {
        userApproved: false,
        destinationCredentialsValid: true,
        publicationTargetValid: true,
      },
    );
    assert.equal(view.publishGate.action, "AWAITING_APPROVAL");
    assert.equal(view.publishActionLabel, "Approve for Publishing");
  });

  it("does not report brand-fit when score is absent", () => {
    const view = buildReviewProductionView({
      id: "prod-7",
      title: "No brand fit",
    });
    assert.equal(view.brandFitScore, null);
    assert.match(String(view.brandFitUnavailableReason), /unavailable/i);
  });
});
