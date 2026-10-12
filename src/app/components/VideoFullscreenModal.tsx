import { useEffect, useRef, useState } from "react";
import { X, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { isEphemeralMediaUrl } from "../services/production/productionAssetService";
import { subscribeToIngest, scheduleAutoIngestMedia } from "../services/production/ingestMediaToSpark";

export function VideoFullscreenModal({
  videoUrl,
  title,
  productionId,
  brandId,
  onClose,
}: {
  videoUrl: string;
  title?: string;
  productionId?: string;
  brandId?: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentSrc, setCurrentSrc] = useState(videoUrl);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setCurrentSrc(videoUrl);
  }, [videoUrl]);

  useEffect(() => {
    if (currentSrc && isEphemeralMediaUrl(currentSrc)) {
      const unsub = subscribeToIngest(currentSrc, (sparkUrl) => {
        setCurrentSrc(sparkUrl);
      });
      void scheduleAutoIngestMedia({
        url: currentSrc,
        productionId: productionId || "default-prod",
        brandId,
        assetType: "video",
        onSuccess: (sparkUrl) => {
          setCurrentSrc(sparkUrl);
        },
      });
      return unsub;
    }
  }, [currentSrc, productionId, brandId]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration) setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B0F17] flex flex-col justify-between overflow-hidden select-none">
      {/* Header Bar with Onboard-style Close Button */}
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 z-20 bg-gradient-to-b from-[#0B0F17] via-[#0B0F17]/90 to-transparent">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider truncate max-w-[220px]">
            {title || "Spark Production"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-white transition-all cursor-pointer shadow-lg"
          aria-label="Close video player"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main Video Viewport — Contain in correct aspect */}
      <div
        className="flex-1 relative flex items-center justify-center bg-black/90 cursor-pointer overflow-hidden"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={currentSrc}
          autoPlay
          playsInline
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="w-full h-full object-contain max-h-[85vh]"
        />

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl scale-110">
              <Play className="w-8 h-8 fill-current text-black translate-x-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar — Copy Onboard Language */}
      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/90 to-transparent z-20 space-y-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-white/70">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
            className="flex-1 h-1.5 accent-purple-500 bg-white/20 rounded-full cursor-pointer"
          />
          <span className="text-[10px] font-mono text-white/40">{formatTime(duration)}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={togglePlay}
            className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? "Pause" : "Play Video"}</span>
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/15 transition-all"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
