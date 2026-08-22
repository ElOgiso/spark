import React, { useState } from "react";
import { ArrowLeft, ShieldCheck, Check, Sparkles, Save, RotateCcw } from "lucide-react";
import { useSpark } from "../state/SparkContext";
import { DEFAULT_CREDIT_SETTINGS, GenerationCreditSettings } from "../domain/types";

interface CreditControlPanelProps {
  onNavigate: (path: string) => void;
}

export function CreditControlPanel({ onNavigate }: CreditControlPanelProps) {
  const { creditSettings, updateCreditSettings } = useSpark();

  const [settings, setSettings] = useState<GenerationCreditSettings>(
    creditSettings || DEFAULT_CREDIT_SETTINGS
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSave = () => {
    updateCreditSettings(settings);
    setToastMessage("Credit control settings saved.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_CREDIT_SETTINGS);
    updateCreditSettings(DEFAULT_CREDIT_SETTINGS);
    setToastMessage("Reset to pipeline defaults (3 thumbs, 3 keyframes, 8s/12s).");
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="w-full min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("/more")}
              className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0 hover:bg-accent/30 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Credit control</h1>
              <p className="text-xs text-muted-foreground">
                Limit how many assets SPARK generates per production
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            title="Reset to defaults"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Column */}
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        
        {/* Toast alert */}
        {toastMessage && (
          <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-medium flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Card 1: Thumbnails */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Thumbnails</h3>
              <p className="text-xs text-muted-foreground">
                Number of thumbnail variants synthesized per production
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-accent/15 text-accent">
              {settings.thumbnailCount} {settings.thumbnailCount === 1 ? "variant" : "variants"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => setSettings({ ...settings, thumbnailCount: num })}
                className={`py-3.5 px-3 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] ${
                  settings.thumbnailCount === num
                    ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                    : "border-border bg-background hover:bg-accent/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                {num} {num === 1 ? "variant" : "variants"}
              </button>
            ))}
          </div>
        </div>

        {/* Card 2: Keyframes / Storyboard Panels */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Keyframes / Storyboard panels</h3>
              <p className="text-xs text-muted-foreground">
                Sequential visual map panels generated per production
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-accent/15 text-accent">
              {settings.keyframeCount} {settings.keyframeCount === 1 ? "panel" : "panels"}
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2 pt-1">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                onClick={() => setSettings({ ...settings, keyframeCount: num, maxVideoClips: num })}
                className={`py-3.5 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] ${
                  settings.keyframeCount === num
                    ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                    : "border-border bg-background hover:bg-accent/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Card 3: Shorts Duration */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Shorts length</h3>
              <p className="text-xs text-muted-foreground">
                Target video clip duration for standard short-form content
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-accent/15 text-accent">
              {settings.shortsDurationSec}s
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2.5 pt-1">
            {[5, 8, 10, 15].map((sec) => (
              <button
                key={sec}
                onClick={() => setSettings({ ...settings, shortsDurationSec: sec })}
                className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] ${
                  settings.shortsDurationSec === sec
                    ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                    : "border-border bg-background hover:bg-accent/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Card 4: Cinematic Duration */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Cinematic length</h3>
              <p className="text-xs text-muted-foreground">
                Target video clip duration for deep storytelling mode
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-accent/15 text-accent">
              {settings.cinematicDurationSec}s
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2.5 pt-1">
            {[8, 12, 15, 20].map((sec) => (
              <button
                key={sec}
                onClick={() => setSettings({ ...settings, cinematicDurationSec: sec })}
                className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] ${
                  settings.cinematicDurationSec === sec
                    ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                    : "border-border bg-background hover:bg-accent/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Save Action */}
        <button
          onClick={handleSave}
          className="w-full py-4 bg-accent hover:bg-accent/90 active:bg-accent/80 text-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
        >
          <Save className="w-5 h-5 text-accent-foreground" />
          Save Credit Control Settings
        </button>

        {/* Helper Footer */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border/40 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fewer assets = lower credit use. SPARK still picks best when multiple.
          </p>
        </div>

      </div>
    </div>
  );
}
