import { useMemo, useState } from "react";
import {
  EDIT_REQUEST_CATEGORIES,
  formatEditRequestNote,
  statusLabel,
  statusTone,
  type ReviewNamedCheck,
  type ReviewProductionView,
  type ReviewShotView,
} from "../services/production/reviewPresentation";

export interface ReviewIntelligencePanelProps {
  reviewView: ReviewProductionView;
  selectedSceneId: string | null;
  selectedShotId: string | null;
  onSelectScene: (sceneId: string) => void;
  onSelectShot: (shotId: string) => void;
  onSelectCandidate: (shotId: string, candidateId: string) => void;
  onRequestEdit: (payload: {
    categories: string[];
    notes: string;
    shotId: string | null;
    sceneId: string | null;
    formattedNote: string;
  }) => void;
  editSubmitting?: boolean;
}

function CheckList({ title, checks }: { title: string; checks: ReviewNamedCheck[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.id} className="p-3 rounded-lg bg-background border border-border/70">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{check.label}</p>
              <span className={`text-xs font-semibold ${statusTone(check.status)}`}>
                {statusLabel(check.status)}
              </span>
            </div>
            {check.detail ? <p className="text-xs text-muted-foreground mt-1">{check.detail}</p> : null}
            {(check.expected || check.observed) && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {check.expected ? (
                  <p>
                    <span className="text-muted-foreground">Expected: </span>
                    {check.expected}
                  </p>
                ) : null}
                {check.observed ? (
                  <p>
                    <span className="text-muted-foreground">Observed: </span>
                    {check.observed}
                  </p>
                ) : null}
              </div>
            )}
            {check.recommendedAction ? (
              <p className="text-xs text-amber-300/90 mt-2">Action: {check.recommendedAction}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntendedVsActual({ shot }: { shot: ReviewShotView }) {
  const intendedRows: Array<[string, string]> = [
    ["Purpose", shot.intended.purpose],
    ["Framing", shot.intended.framing],
    ["Camera", shot.intended.cameraIntent],
    ["Blocking", shot.intended.blocking],
    ["Action", shot.intended.action],
    ["Lighting", shot.intended.lightingIntent],
    ["Continuity", shot.intended.continuityRequirements],
    ["Duration", shot.intended.durationIntent],
    ["Transition", shot.intended.transitionIntent],
  ];
  const actualRows: Array<[string, string]> = [
    ["Duration", shot.actual.duration],
    ["Framing", shot.actual.framing],
    ["Movement", shot.actual.observedMovement],
    ["Action", shot.actual.observedAction],
    ["Continuity", shot.actual.continuityResult],
    ["Technical", shot.actual.technicalResult],
    ["QC", shot.actual.qcResult],
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold">Intended vs Actual</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Intended</p>
          {intendedRows.map(([label, value]) => (
            <div key={label} className="p-3 rounded-lg bg-background border border-border/60">
              <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
              <p className="text-sm">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Actual</p>
          {actualRows.map(([label, value]) => (
            <div key={label} className="p-3 rounded-lg bg-background border border-border/60">
              <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
              <p className="text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReviewIntelligencePanel({
  reviewView,
  selectedSceneId,
  selectedShotId,
  onSelectScene,
  onSelectShot,
  onSelectCandidate,
  onRequestEdit,
  editSubmitting = false,
}: ReviewIntelligencePanelProps) {
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [generationOpen, setGenerationOpen] = useState(false);

  const selectedScene =
    reviewView.scenes.find((scene) => scene.id === selectedSceneId) ?? reviewView.scenes[0] ?? null;

  const sceneShots = useMemo(() => {
    if (!selectedScene) return reviewView.shots;
    return reviewView.shots.filter((shot) => selectedScene.shotIds.includes(shot.id));
  }, [reviewView.shots, selectedScene]);

  const selectedShot =
    sceneShots.find((shot) => shot.id === selectedShotId) ?? sceneShots[0] ?? null;

  const toggleCategory = (category: string) => {
    setEditCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  return (
    <div className="space-y-6">
      {reviewView.scenes.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Scenes</h3>
            <span className="text-xs text-muted-foreground">{reviewView.scenes.length} total</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {reviewView.scenes.map((scene) => {
              const active = selectedScene?.id === scene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => onSelectScene(scene.id)}
                  className={`px-3 py-2 rounded-lg border text-left min-w-[140px] transition-colors ${
                    active
                      ? "border-accent bg-accent/15 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <p className="text-xs font-semibold truncate">{scene.title}</p>
                  <p className="text-[10px] opacity-70">
                    {scene.shotIds.length} shots · {scene.status}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Shots</h3>
          {reviewView.storyboardSheetUrl ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Storyboard sheet available
            </span>
          ) : null}
        </div>
        {reviewView.storyboardSheetUrl ? (
          <div className="rounded-lg border border-border/70 bg-black/30 overflow-hidden aspect-video max-h-72 flex items-center justify-center">
            <img
              src={reviewView.storyboardSheetUrl}
              alt="Storyboard sheet"
              className="max-w-full max-h-full w-auto h-auto object-contain"
            />
          </div>
        ) : null}
        <div className="flex gap-3 overflow-x-auto pb-1">
          {sceneShots.map((shot) => {
            const active = selectedShot?.id === shot.id;
            return (
              <button
                key={shot.id}
                type="button"
                onClick={() => onSelectShot(shot.id)}
                className={`min-w-[160px] max-w-[180px] rounded-xl border p-2 text-left transition-colors ${
                  active
                    ? "border-accent bg-accent/15"
                    : "border-border bg-background hover:border-accent/40"
                }`}
              >
                <div className="w-full aspect-[9/16] max-h-40 rounded-lg overflow-hidden bg-black/40 border border-border/50 mb-2 flex items-center justify-center">
                  {shot.storyboardFrameUrl || shot.generatedResultUrl ? (
                    <img
                      src={shot.storyboardFrameUrl || shot.generatedResultUrl || ""}
                      alt={shot.title}
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                      No frame
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold truncate">{shot.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{shot.status}</p>
              </button>
            );
          })}
          {!sceneShots.length ? (
            <p className="text-xs text-muted-foreground">No shots available for this scene yet.</p>
          ) : null}
        </div>
      </div>

      {selectedShot ? (
        <>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{selectedShot.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedShot.purpose}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-muted/40 text-muted-foreground">
                {selectedShot.status}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-background border border-border/70 space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Storyboard frame</p>
                <div className="aspect-[9/16] max-h-48 rounded-md overflow-hidden bg-black/30 border border-border/50 flex items-center justify-center">
                  {selectedShot.storyboardFrameUrl ? (
                    <img
                      src={selectedShot.storyboardFrameUrl}
                      alt="Storyboard frame"
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No storyboard frame</span>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border/70 space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Generated result</p>
                <div className="aspect-[9/16] max-h-48 rounded-md overflow-hidden bg-black/30 border border-border/50 flex items-center justify-center">
                  {selectedShot.generatedResultUrl ? (
                    <img
                      src={selectedShot.generatedResultUrl}
                      alt="Generated result"
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No generated result</span>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border/70 space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Generated state frame
                </p>
                <div className="aspect-[9/16] max-h-48 rounded-md overflow-hidden bg-black/30 border border-border/50 flex items-center justify-center">
                  {selectedShot.generatedStateFrameUrl ? (
                    <img
                      src={selectedShot.generatedStateFrameUrl}
                      alt="Generated state frame"
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No state frame</span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <p>
                <span className="text-muted-foreground">Dramatic beat: </span>
                {selectedShot.dramaticBeat}
              </p>
              <p>
                <span className="text-muted-foreground">Visual objective: </span>
                {selectedShot.visualObjective}
              </p>
              <p>
                <span className="text-muted-foreground">Frame strategy: </span>
                {selectedShot.frameStrategy || "—"}
              </p>
            </div>
          </div>

          <IntendedVsActual shot={selectedShot} />

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Candidates</h3>
            {selectedShot.candidates.length ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedShot.candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => onSelectCandidate(selectedShot.id, candidate.id)}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      candidate.selected
                        ? "border-accent bg-accent/15"
                        : "border-border bg-background hover:border-accent/40"
                    }`}
                  >
                    <div className="h-28 rounded-lg overflow-hidden bg-black/30 border border-border/50 mb-2 flex items-center justify-center">
                      {candidate.mediaUrl ? (
                        <img
                          src={candidate.mediaUrl}
                          alt={candidate.label}
                          className="max-w-full max-h-full w-auto h-auto object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No media</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold">{candidate.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Overall: {candidate.overall == null ? "Not scored" : candidate.overall}
                    </p>
                    <div className="mt-2 space-y-1">
                      {candidate.scores
                        .filter((score) => score.dimension !== "overall")
                        .map((score) => (
                          <p key={score.dimension} className="text-[10px] text-muted-foreground">
                            {score.label}: {score.value == null ? "—" : score.value}
                          </p>
                        ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No candidates recorded for this shot.</p>
            )}
          </div>

          <CheckList title="QC" checks={selectedShot.qcChecks} />
          <CheckList title="Continuity" checks={selectedShot.continuityChecks} />

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">References used for this shot</h3>
            {selectedShot.references.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedShot.references.map((ref) => (
                  <div
                    key={ref.id}
                    className="p-3 rounded-lg border border-border/70 bg-background flex gap-3"
                  >
                    <div className="w-14 h-14 rounded-md overflow-hidden bg-black/30 border border-border/50 flex items-center justify-center shrink-0">
                      {ref.url ? (
                        <img src={ref.url} alt={ref.label} className="max-w-full max-h-full w-auto h-auto object-contain" />
                      ) : (
                        <span className="text-[9px] text-muted-foreground">N/A</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ref.label}</p>
                      <p className="text-[11px] text-muted-foreground">{ref.kind}</p>
                      <p className="text-[11px] mt-1 capitalize">{ref.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No shot-linked references recorded.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              className="w-full px-5 py-4 flex items-center justify-between text-left"
              onClick={() => setGenerationOpen((open) => !open)}
            >
              <h3 className="text-sm font-semibold">Generation details</h3>
              <span className="text-xs text-muted-foreground">{generationOpen ? "Hide" : "Show"}</span>
            </button>
            {generationOpen ? (
              <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Provider: </span>
                  {selectedShot.generation.provider || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Model: </span>
                  {selectedShot.generation.model || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Strategy: </span>
                  {selectedShot.generation.strategy || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Duration: </span>
                  {selectedShot.generation.duration || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Resolution: </span>
                  {selectedShot.generation.resolution || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Aspect ratio: </span>
                  {selectedShot.generation.aspectRatio || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Attempt: </span>
                  {selectedShot.generation.attemptNumber ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Selected candidate: </span>
                  {selectedShot.generation.selectedCandidateId || "—"}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">References used: </span>
                  {selectedShot.generation.referencesUsed.length
                    ? selectedShot.generation.referencesUsed.join(", ")
                    : "—"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Request changes</h3>
            <p className="text-xs text-muted-foreground">
              Feedback is stored on the review item and used for localized regeneration of the selected
              shot when possible.
            </p>
            <div className="flex flex-wrap gap-2">
              {EDIT_REQUEST_CATEGORIES.map((category) => {
                const active = editCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      active
                        ? "border-accent bg-accent/20 text-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
            <textarea
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              placeholder="What should change?"
              className="w-full min-h-[96px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={editSubmitting}
              onClick={() => {
                if (!editNotes.trim() && editCategories.length === 0) return;
                const formattedNote = formatEditRequestNote(editCategories, editNotes);
                onRequestEdit({
                  categories: editCategories,
                  notes: editNotes,
                  shotId: selectedShot.id,
                  sceneId: selectedScene?.id ?? selectedShot.sceneId,
                  formattedNote,
                });
                setEditNotes("");
                setEditCategories([]);
              }}
              className="px-4 py-2.5 rounded-xl bg-accent/20 border border-accent/40 text-sm font-semibold hover:bg-accent/30 disabled:opacity-50"
            >
              {editSubmitting ? "Submitting..." : "Request regeneration"}
            </button>
          </div>
        </>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Production readiness</h3>
          <span className="text-xs font-semibold text-muted-foreground">
            {reviewView.publishActionLabel}
          </span>
        </div>
        <div className="space-y-2">
          {reviewView.readiness.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg bg-background border border-border/70"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                {item.detail ? <p className="text-xs text-muted-foreground mt-1">{item.detail}</p> : null}
              </div>
              <span className={`text-xs font-semibold ${statusTone(item.status)}`}>
                {statusLabel(item.status)}
              </span>
            </div>
          ))}
        </div>
        {reviewView.publishGate.action !== "PUBLISH" ? (
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-200">Cannot publish yet</p>
            <p className="text-xs text-amber-100/90 mt-1">
              {reviewView.publishGate.reasons[0] || "Publishing policy requirements are not met."}
            </p>
          </div>
        ) : null}
      </div>

      {reviewView.lifecycle ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Production Lifecycle & Execution</h3>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                reviewView.lifecycle.ok
                  ? "bg-emerald-500/20 text-emerald-400"
                  : reviewView.lifecycle.completed
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-red-500/20 text-red-400"
              }`}
            >
              {reviewView.lifecycle.phase ?? "Lifecycle Complete"}
            </span>
          </div>
          {reviewView.lifecycle.summary ? (
            <p className="text-xs text-muted-foreground">{reviewView.lifecycle.summary}</p>
          ) : null}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-background border border-border/70">
              <p className="text-[10px] text-muted-foreground">Deliverable</p>
              <p className="font-medium mt-0.5">
                {reviewView.lifecycle.deliverableReady ? "Ready" : "Pending"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border/70">
              <p className="text-[10px] text-muted-foreground">QC Verdict</p>
              <p className="font-medium mt-0.5 capitalize">
                {reviewView.lifecycle.qcVerdict || "Passed"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border/70">
              <p className="text-[10px] text-muted-foreground">Cost</p>
              <p className="font-medium mt-0.5">
                {reviewView.lifecycle.cost?.actualTotalUsd != null
                  ? `$${reviewView.lifecycle.cost.actualTotalUsd.toFixed(3)}`
                  : reviewView.lifecycle.cost?.estimatedTotalUsd != null
                    ? `~$${reviewView.lifecycle.cost.estimatedTotalUsd.toFixed(3)}`
                    : "Included"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border/70">
              <p className="text-[10px] text-muted-foreground">Wall Clock</p>
              <p className="font-medium mt-0.5">
                {reviewView.lifecycle.timing?.wallClockMs != null
                  ? `${(reviewView.lifecycle.timing.wallClockMs / 1000).toFixed(1)}s`
                  : "—"}
              </p>
            </div>
          </div>
          {reviewView.lifecycle.preflightSummary ? (
            <div className="p-3 rounded-lg bg-background border border-border/70 text-xs">
              <span className="text-muted-foreground font-medium">Preflight: </span>
              <span>{reviewView.lifecycle.preflightSummary}</span>
            </div>
          ) : null}
          {reviewView.lifecycle.editorialDecision ? (
            <div className="p-3 rounded-lg bg-background border border-border/70 text-xs">
              <span className="text-muted-foreground font-medium">Editorial Decision: </span>
              <span className="capitalize">{reviewView.lifecycle.editorialDecision}</span>
            </div>
          ) : null}
          {reviewView.lifecycle.errors && reviewView.lifecycle.errors.length > 0 ? (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300">
              <p className="font-semibold mb-1">Errors encountered:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {reviewView.lifecycle.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
