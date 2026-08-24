import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  X,
  Wrench,
  Loader2,
  Film,
  Maximize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { VideoFullscreenModal } from "./mobile/DonorSparkMediaHome";

export interface DesktopSceneItem {
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

export interface DesktopProductionAssetsGalleryProps {
  onBack: () => void;
  production: any;
  item?: any;
}

export function DesktopProductionAssetsGallery({
  onBack,
  production,
  item,
}: DesktopProductionAssetsGalleryProps) {
  const activeProd = production || item?.production;
  const brief = activeProd?.brief || item?.brief;
  const title = brief?.title || activeProd?.title || item?.title || "Production Assets";

  const rawStoryboard = brief?.storyboard || activeProd?.storyboard || [];
  const rawClips = brief?.generatedAssets?.generatedVideos || activeProd?.clips || [];

  const initialScenes: DesktopSceneItem[] =
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

  const [scenes, setScenes] = useState<DesktopSceneItem[]>(initialScenes);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(initialScenes[0]?.id || "scene-1");
  const [isPlayingFocus, setIsPlayingFocus] = useState(false);
  const [fullscreenVideo, setFullscreenVideo] = useState<{ url: string; title: string } | null>(null);
  const [fixTargetScene, setFixTargetScene] = useState<DesktopSceneItem | null>(null);
  const [fixNotes, setFixNotes] = useState("");
  const [approvedMaster, setApprovedMaster] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const focusVideoRef = useRef<HTMLVideoElement | null>(null);
  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];
  const isOneTake = scenes.length === 1;

  const readyCount = scenes.filter((s) => s.status === "Ready" || s.status === "Approved").length;
  const needsFixCount = scenes.filter((s) => s.status === "Needs fix").length;
  const generatingCount = scenes.filter((s) => s.status === "Generating").length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Keyboard navigation: Left/Right to change selected scene, Space to toggle play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (fixTargetScene || fullscreenVideo) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight") {
        const currentIdx = scenes.findIndex((s) => s.id === selectedSceneId);
        if (currentIdx >= 0 && currentIdx < scenes.length - 1) {
          setSelectedSceneId(scenes[currentIdx + 1].id);
        }
      } else if (e.key === "ArrowLeft") {
        const currentIdx = scenes.findIndex((s) => s.id === selectedSceneId);
        if (currentIdx > 0) {
          setSelectedSceneId(scenes[currentIdx - 1].id);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        if (focusVideoRef.current && selectedScene?.videoUrl) {
          if (isPlayingFocus) {
            focusVideoRef.current.pause();
            setIsPlayingFocus(false);
          } else {
            focusVideoRef.current.play().catch(() => {});
            setIsPlayingFocus(true);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scenes, selectedSceneId, fixTargetScene, fullscreenVideo, isPlayingFocus, selectedScene]);

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
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col overflow-hidden select-none">
      {/* Header Bar */}
      <header className="px-6 py-4 bg-[#0B0F17] border-b border-white/10 flex items-center justify-between z-20">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white shrink-0 cursor-pointer flex items-center gap-2 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
            <span>Back to Review</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-white truncate">Production assets</h1>
            <p className="text-xs text-white/50 truncate font-mono mt-0.5">
              {title} · {scenes.length} {scenes.length === 1 ? "scene" : "scenes"} · {isOneTake ? "One-Take Master" : "Multi-Scene Sequence"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {toastMessage && (
            <div className="px-3 py-1.5 rounded-xl bg-purple-600/90 text-white text-xs font-medium border border-purple-400/50 flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span>{toastMessage}</span>
            </div>
          )}
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300">
            {isOneTake ? "One-Take" : "Multi-Scene Timeline"}
          </span>
        </div>
      </header>

      {/* Main Split-Screen Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT ZONE: Scrollable Scene Grid (~58% width) */}
        <section className="flex-1 flex flex-col min-w-0 border-r border-white/10 bg-[#0B0F17]">
          <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between text-xs font-mono text-white/60">
            <span>Storyboard Scenes ({scenes.length})</span>
            <span>Use ← / → keys to navigate</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {scenes.map((scene) => {
                const isSelected = scene.id === selectedSceneId;
                const isGenerating = scene.status === "Generating";
                const isNeedsFix = scene.status === "Needs fix";
                const isApproved = scene.status === "Approved" || approvedMaster;
                const hasVideo = Boolean(scene.videoUrl);

                return (
                  <div
                    key={scene.id}
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={`bg-white/[0.035] border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "border-purple-500 shadow-xl shadow-purple-500/10 ring-1 ring-purple-500/50"
                        : "border-white/[0.09] hover:border-white/20 active:scale-[0.99]"
                    }`}
                  >
                    {/* Media Container */}
                    <div className="relative aspect-[9/16] bg-black/60 flex items-center justify-center overflow-hidden group">
                      {scene.thumbUrl ? (
                        <img
                          src={scene.thumbUrl}
                          alt={scene.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-950/40 via-background to-black flex flex-col items-center justify-center p-3 text-center">
                          <Film className="w-8 h-8 text-white/20 mb-2" />
                          <span className="text-xs text-white/40 font-mono">Scene {scene.index}</span>
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
                          <p className="text-xs font-semibold text-purple-200">Generating scene {scene.index}…</p>
                        </div>
                      )}

                      {/* Center Play Button Control */}
                      {!isGenerating && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasVideo) {
                              setFullscreenVideo({ url: scene.videoUrl!, title: `Scene ${scene.index} · ${title}` });
                            } else {
                              setSelectedSceneId(scene.id);
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white backdrop-blur-md group-hover:scale-110 transition-transform shadow-lg cursor-pointer"
                        >
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

                    {/* Card Footer */}
                    <div className="p-3 bg-[#0B0F17]/80 border-t border-white/5 space-y-1">
                      <p className="text-xs text-white/70 line-clamp-1 font-medium" title={scene.beatLine}>
                        {scene.beatLine}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* RIGHT ZONE: Focus Preview Pane (~42% width) */}
        <aside className="w-[420px] lg:w-[480px] xl:w-[540px] flex flex-col bg-[#0B0F17] shrink-0">
          <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between text-xs font-mono text-white/60">
            <span>Focus Preview Pane</span>
            <span>Press Space to Play/Pause</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Stage Viewer Container */}
            <div className="relative aspect-[9/16] max-h-[460px] mx-auto rounded-2xl bg-black border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center group">
              {selectedScene.videoUrl ? (
                <video
                  ref={focusVideoRef}
                  src={selectedScene.videoUrl}
                  playsInline
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={() => {
                    if (focusVideoRef.current) {
                      if (isPlayingFocus) {
                        focusVideoRef.current.pause();
                        setIsPlayingFocus(false);
                      } else {
                        focusVideoRef.current.play().catch(() => {});
                        setIsPlayingFocus(true);
                      }
                    }
                  }}
                  onEnded={() => setIsPlayingFocus(false)}
                />
              ) : selectedScene.thumbUrl ? (
                <img
                  src={selectedScene.thumbUrl}
                  alt={selectedScene.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-white/40 font-mono">
                  <Film className="w-12 h-12 text-white/20 mb-3" />
                  <p className="text-sm font-semibold">Preparing Scene {selectedScene.index} preview…</p>
                </div>
              )}

              {/* Play/Pause Overlay Control */}
              {selectedScene.videoUrl && (
                <div
                  onClick={() => {
                    if (focusVideoRef.current) {
                      if (isPlayingFocus) {
                        focusVideoRef.current.pause();
                        setIsPlayingFocus(false);
                      } else {
                        focusVideoRef.current.play().catch(() => {});
                        setIsPlayingFocus(true);
                      }
                    }
                  }}
                  className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white backdrop-blur-md shadow-2xl">
                    {isPlayingFocus ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white fill-current ml-1" />
                    )}
                  </div>
                </div>
              )}

              {/* Fullscreen Expand Button */}
              {selectedScene.videoUrl && (
                <button
                  onClick={() => setFullscreenVideo({ url: selectedScene.videoUrl!, title: `Scene ${selectedScene.index} · ${title}` })}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-black/70 border border-white/10 hover:bg-black/90 text-white backdrop-blur-md cursor-pointer transition-transform active:scale-95"
                  title="Expand to Fullscreen"
                >
                  <Maximize2 className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Scene Metadata & Actions */}
            <div className="space-y-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Scene {selectedScene.index} Details</h3>
                  <p className="text-xs text-white/50 font-mono mt-0.5">Duration: 0:0{selectedScene.durationSec} · {selectedScene.status}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  selectedScene.status === "Approved" || approvedMaster
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : selectedScene.status === "Needs fix"
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-purple-500/20 border-purple-500/40 text-purple-300"
                }`}>
                  {selectedScene.status}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-xs text-white/40 font-mono uppercase tracking-wider mb-1">Beat / Typography Overlay</p>
                <p className="text-xs text-white/80 font-medium leading-relaxed">{selectedScene.beatLine}</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setFixTargetScene(selectedScene)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Wrench className="w-4 h-4 text-purple-400" /> Fix this scene
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Fix Scene Modal (Desktop Onboard-Styled) */}
      {fixTargetScene && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#141A26] border border-white/15 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-purple-400" /> Fix scene {fixTargetScene.index}
              </h2>
              <button
                onClick={() => setFixTargetScene(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Describe what should change in Scene {fixTargetScene.index}. SPARK will update the keyframe prompt and regenerate the clip.
            </p>

            <textarea
              value={fixNotes}
              onChange={(e) => setFixNotes(e.target.value)}
              placeholder="What should change? (e.g. adjust host action, camera framing, lower-third typography, or lighting atmosphere)..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none font-sans"
            />

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setFixTargetScene(null)}
                className="flex-1 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFixSubmit}
                className="flex-1 py-3.5 rounded-xl bg-[#a855f7] hover:bg-[#9333ea] active:scale-[0.99] font-bold text-xs text-white shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RotateCw className="w-4 h-4 text-white" /> Regenerate scene
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Video Modal */}
      {fullscreenVideo && (
        <VideoFullscreenModal
          videoUrl={fullscreenVideo.url}
          title={fullscreenVideo.title}
          onClose={() => setFullscreenVideo(null)}
        />
      )}

      {/* Solid Sticky Bottom Bar */}
      <footer className="bg-[#0B0F17] border-t border-white/10 px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2 text-xs font-mono text-white/70">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span>
            {readyCount} of {scenes.length} scenes ready
            {needsFixCount > 0 ? ` · ${needsFixCount} needs fix` : ""}
            {generatingCount > 0 ? ` · ${generatingCount} generating` : ""}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-xs text-white/40 font-mono hidden sm:block">
            Merges approved scenes. Does not regenerate the full film.
          </p>
          <button
            onClick={handleApproveMerge}
            disabled={approvedMaster}
            className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
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
        </div>
      </footer>
    </div>
  );
}
