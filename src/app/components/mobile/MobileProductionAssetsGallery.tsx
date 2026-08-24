import React, { useState } from "react";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  X,
  Wrench,
  Loader2,
  Film,
} from "lucide-react";
import { VideoFullscreenModal } from "./DonorSparkMediaHome";

export interface ProductionSceneItem {
  id: string;
  index: number;
  title: string;
  durationSec: number;
  status: "Generating" | "Ready" | "Needs fix" | "Approved";
  thumbUrl?: string;
  videoUrl?: string;
  beatLine?: string;
  visualDescription?: string;
}

export interface MobileProductionAssetsGalleryProps {
  onBack: () => void;
  production: any;
  item?: any;
}

export function MobileProductionAssetsGallery({
  onBack,
  production,
  item,
}: MobileProductionAssetsGalleryProps) {
  const activeProd = production || item?.production;
  const brief = activeProd?.brief || item?.brief;
  const title = brief?.title || activeProd?.title || item?.title || "Production Assets";

  // Map real storyboard scenes if available, else local fallback
  const rawStoryboard = brief?.storyboard || activeProd?.storyboard || [];
  const rawClips = brief?.generatedAssets?.generatedVideos || activeProd?.clips || [];

  const initialScenes: ProductionSceneItem[] =
    rawStoryboard.length > 0
      ? rawStoryboard.map((s: any, idx: number) => {
          const clipUrl = rawClips[idx] || (idx === 0 ? activeProd?.videoUrl || brief?.videoUrl : undefined);
          return {
            id: `scene-${idx + 1}`,
            index: idx + 1,
            title: `Scene ${idx + 1}`,
            durationSec: s.durationSec || 8,
            status: clipUrl ? "Ready" : idx === 0 && activeProd?.isGeneratingAssets ? "Generating" : "Ready",
            thumbUrl: s.image || s.keyframeUrl || brief?.generatedAssets?.generatedThumbnails?.[idx] || undefined,
            videoUrl: clipUrl,
            beatLine: s.onScreenText || s.scriptSnippet || s.visualDescription || s.primaryChange || "Sequential scene beat",
            visualDescription: s.visualDescription,
          };
        })
      : [
          {
            id: "scene-master",
            index: 1,
            title: "Master Production",
            durationSec: 12,
            status: activeProd?.videoUrl || brief?.videoUrl ? "Ready" : "Generating",
            thumbUrl: brief?.generatedAssets?.generatedThumbnails?.[0] || undefined,
            videoUrl: activeProd?.videoUrl || brief?.videoUrl || brief?.generatedAssets?.generatedVideos?.[0],
            beatLine: brief?.hook || "Full production one-take master video",
          },
        ];

  const [scenes, setScenes] = useState<ProductionSceneItem[]>(initialScenes);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string } | null>(null);
  const [fixTargetScene, setFixTargetScene] = useState<ProductionSceneItem | null>(null);
  const [fixNotes, setFixNotes] = useState("");
  const [approvedMaster, setApprovedMaster] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isOneTake = scenes.length === 1;
  const readyCount = scenes.filter((s) => s.status === "Ready" || s.status === "Approved").length;
  const needsFixCount = scenes.filter((s) => s.status === "Needs fix").length;
  const generatingCount = scenes.filter((s) => s.status === "Generating").length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFixSubmit = () => {
    if (!fixTargetScene) return;
    setScenes((prev) =>
      prev.map((s) =>
        s.id === fixTargetScene.id
          ? { ...s, status: "Needs fix", beatLine: fixNotes.trim() ? `Fix requested: ${fixNotes.slice(0, 40)}` : s.beatLine }
          : s
      )
    );
    showToast(`Fix requested for Scene ${fixTargetScene.index}. Marked for revision.`);
    setFixTargetScene(null);
    setFixNotes("");
  };

  const handleApproveMerge = () => {
    setScenes((prev) => prev.map((s) => ({ ...s, status: "Approved" })));
    setApprovedMaster(true);
    showToast(isOneTake ? "Master video approved for publishing!" : "Approved scenes merged into master video!");
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] text-white flex flex-col overflow-hidden select-none">
      {/* Header Bar */}
      <header className="px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3 bg-[#0B0F17]/95 border-b border-white/10 flex items-center justify-between z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white shrink-0 cursor-pointer"
            aria-label="Back to review"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate">Production assets</h1>
            <p className="text-[11px] text-white/50 truncate font-mono mt-0.5">
              {title} · {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300">
            {isOneTake ? "One-Take Master" : "Multi-Scene"}
          </span>
        </div>
      </header>

      {/* Progress Strip */}
      <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-white/70">
            {readyCount}/{scenes.length} ready
            {needsFixCount > 0 ? ` · ${needsFixCount} needs fix` : ""}
            {generatingCount > 0 ? ` · ${generatingCount} generating` : ""}
          </span>
        </div>
        {approvedMaster && (
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Approved
          </span>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-purple-600/90 text-white text-xs font-medium border border-purple-400/50 shadow-lg shadow-purple-600/30 flex items-center justify-between z-30 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-200 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/70 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2-Column Scenes Grid Body */}
      <main className="flex-1 overflow-y-auto p-4 pb-36">
        <div className="grid grid-cols-2 gap-3">
          {scenes.map((scene) => {
            const isGenerating = scene.status === "Generating";
            const isNeedsFix = scene.status === "Needs fix";
            const isApproved = scene.status === "Approved" || approvedMaster;
            const hasVideo = Boolean(scene.videoUrl);

            return (
              <div
                key={scene.id}
                className="bg-white/[0.035] border border-white/[0.09] rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:border-white/20 active:scale-[0.98]"
              >
                {/* Media Container */}
                <div
                  className="relative aspect-[9/16] bg-black/60 flex items-center justify-center overflow-hidden cursor-pointer group"
                  onClick={() => {
                    if (hasVideo) {
                      setActiveVideo({ url: scene.videoUrl!, title: `Scene ${scene.index} · ${title}` });
                    } else if (scene.thumbUrl) {
                      setActiveVideo({ url: scene.thumbUrl, title: `Scene ${scene.index} Keyframe` });
                    }
                  }}
                >
                  {scene.thumbUrl ? (
                    <img
                      src={scene.thumbUrl}
                      alt={scene.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-950/40 via-background to-black flex flex-col items-center justify-center p-3 text-center">
                      <Film className="w-8 h-8 text-white/20 mb-2" />
                      <span className="text-[11px] text-white/40 font-mono">Scene {scene.index}</span>
                    </div>
                  )}

                  {/* Top-Left Scene Badge */}
                  <div className="absolute top-2 left-2 z-10">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/70 border border-white/10 text-white backdrop-blur-md">
                      Scene {scene.index}
                    </span>
                  </div>

                  {/* Top-Right Status Chip */}
                  <div className="absolute top-2 right-2 z-10">
                    {isGenerating ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1 backdrop-blur-md animate-pulse">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Generating
                      </span>
                    ) : isNeedsFix ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-200 flex items-center gap-1 backdrop-blur-md">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" /> Fix
                      </span>
                    ) : isApproved ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400 text-emerald-200 flex items-center gap-1 backdrop-blur-md">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Approved
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400 text-purple-200 flex items-center gap-1 backdrop-blur-md">
                        <CheckCircle2 className="w-2.5 h-2.5 text-purple-300" /> Ready
                      </span>
                    )}
                  </div>

                  {/* Generating Overlay */}
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center z-20">
                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin mb-2" />
                      <p className="text-[11px] font-semibold text-purple-200">Generating scene {scene.index}…</p>
                      <p className="text-[9px] text-white/40 font-mono mt-1">Multi-pass synthesis</p>
                    </div>
                  )}

                  {/* Center Play Button Control */}
                  {!isGenerating && (
                    <div className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white backdrop-blur-md group-hover:scale-110 transition-transform shadow-lg">
                      <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                    </div>
                  )}

                  {/* Bottom-Right Duration */}
                  <div className="absolute bottom-2 right-2 z-10">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/70 border border-white/10 text-white/80 backdrop-blur-md">
                      0:0{scene.durationSec}
                    </span>
                  </div>
                </div>

                {/* Card Info & Actions */}
                <div className="p-3 space-y-2 bg-[#0B0F17]/80 border-t border-white/5">
                  <p className="text-[11px] text-white/70 line-clamp-1 font-medium" title={scene.beatLine}>
                    {scene.beatLine}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setFixTargetScene(scene)}
                      className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-white/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Wrench className="w-3 h-3 text-purple-400" /> Fix scene
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Fix Scene Bottom Sheet */}
      {fixTargetScene && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-[#141A26] border-t border-white/10 rounded-t-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Drag Handle */}
            <div className="w-12 h-1 rounded-full bg-white/20 mx-auto" />

            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-purple-400" /> Fix scene {fixTargetScene.index}
              </h2>
              <button
                onClick={() => setFixTargetScene(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Describe what should change in Scene {fixTargetScene.index}. SPARK will update the storyboard prompt for this scene.
            </p>

            <textarea
              value={fixNotes}
              onChange={(e) => setFixNotes(e.target.value)}
              placeholder="What should change? (e.g. adjust framing, action, typography lower third, or lighting)..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none font-sans"
            />

            <div className="space-y-2 pt-2">
              <button
                onClick={handleFixSubmit}
                className="w-full py-3.5 rounded-xl bg-[#a855f7] hover:bg-[#9333ea] active:scale-[0.99] font-semibold text-xs text-white shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RotateCw className="w-4 h-4 text-white" /> Regenerate scene
              </button>
              <button
                onClick={() => setFixTargetScene(null)}
                className="w-full py-2.5 text-xs text-white/50 hover:text-white transition-colors text-center"
              >
                Cancel
              </button>
            </div>

            {/* Bottom Safe Area Padding */}
            <div className="h-[max(1rem,env(safe-area-inset-bottom))]" />
          </div>
        </div>
      )}

      {/* Fullscreen Video Player Modal */}
      {activeVideo && (
        <VideoFullscreenModal
          videoUrl={activeVideo.url}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      )}

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-[#0B0F17]/95 border-t border-white/10 backdrop-blur-md z-40 space-y-1.5" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <button
          onClick={handleApproveMerge}
          disabled={approvedMaster}
          className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
            approvedMaster
              ? "bg-emerald-600 text-white shadow-emerald-600/30"
              : "bg-[#a855f7] hover:bg-[#9333ea] text-white shadow-purple-600/30 active:scale-[0.99]"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-white" />
          {approvedMaster
            ? "Master Approved"
            : isOneTake
            ? "Approve master"
            : "Approve & merge"}
        </button>
        <p className="text-[10px] text-white/40 text-center font-mono">
          Merges approved scenes into one video. Does not regenerate.
        </p>
      </footer>
    </div>
  );
}
