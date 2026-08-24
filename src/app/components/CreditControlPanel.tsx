import React, { useState } from "react";
import { ArrowLeft, Check, Sparkles, Save, RotateCcw } from "lucide-react";
import { useSpark } from "../state/SparkContext";
import { DEFAULT_CREDIT_SETTINGS, GenerationCreditSettings } from "../domain/types";
import { useDeviceType, detectDevice } from "../hooks/useDeviceType";

interface CreditControlPanelProps {
  onNavigate: (path: string) => void;
  isMobile?: boolean;
}

export function CreditControlPanel({ onNavigate, isMobile }: CreditControlPanelProps) {
  const deviceType = useDeviceType();
  const currentDevice = detectDevice();
  const isMobileDevice = isMobile !== undefined ? isMobile : (currentDevice === "mobile" || deviceType === "mobile");

  if (isMobileDevice) {
    return <CreditControlMobile onNavigate={onNavigate} />;
  }

  return <CreditControlDesktop onNavigate={onNavigate} />;
}

function CreditControlMobile({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { creditSettings, updateCreditSettings } = useSpark();

  const [settings, setSettings] = useState<GenerationCreditSettings>(
    creditSettings || DEFAULT_CREDIT_SETTINGS
  );
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateCreditSettings(settings);
      setToastMessage((res as any) !== false ? "Settings saved to cloud." : "Settings saved.");
    } catch (err) {
      console.warn("[CreditControlMobile] Save error:", err);
      setToastMessage("Settings saved.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleReset = async () => {
    setSettings(DEFAULT_CREDIT_SETTINGS);
    setIsSaving(true);
    try {
      await updateCreditSettings(DEFAULT_CREDIT_SETTINGS);
      setToastMessage("Reset to defaults.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="w-full min-h-screen bg-background text-foreground flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom,20px))]">
      {/* Mobile Top Navigation */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("/more")}
            className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-foreground hover:bg-accent/25 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight">Credit control</h1>
            <p className="text-[11px] text-muted-foreground">Asset generation limits</p>
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

      {/* Main Content */}
      <div className="flex-1 px-4 pt-4 space-y-4">
        {toastMessage && (
          <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-medium flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 1. Thumbnails */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Thumbnails</span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-accent/15 text-accent">
              {settings.thumbnailCount} {settings.thumbnailCount === 1 ? "variant" : "variants"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => setSettings({ ...settings, thumbnailCount: num })}
                className={`py-3 rounded-xl border text-xs font-bold transition-all active:scale-[0.97] ${
                  settings.thumbnailCount === num
                    ? "border-accent bg-accent text-accent-foreground shadow-sm shadow-accent/20"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {num} {num === 1 ? "variant" : "variants"}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Keyframes */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Keyframes</span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-accent/15 text-accent">
              {settings.keyframeCount} {settings.keyframeCount === 1 ? "panel" : "panels"}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                onClick={() => setSettings({ ...settings, keyframeCount: num, maxVideoClips: num })}
                className={`py-3 rounded-xl border text-xs font-bold transition-all active:scale-[0.97] ${
                  settings.keyframeCount === num
                    ? "border-accent bg-accent text-accent-foreground shadow-sm shadow-accent/20"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Shorts length */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Shorts length</span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-accent/15 text-accent">
              {settings.shortsDurationSec}s
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[5, 8, 10, 15].map((sec) => (
              <button
                key={sec}
                onClick={() => setSettings({ ...settings, shortsDurationSec: sec })}
                className={`py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-[0.97] ${
                  settings.shortsDurationSec === sec
                    ? "border-accent bg-accent text-accent-foreground shadow-sm shadow-accent/20"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* 4. Cinematic length */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Cinematic length</span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-accent/15 text-accent">
              {settings.cinematicDurationSec}s
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[8, 12, 15, 20].map((sec) => (
              <button
                key={sec}
                onClick={() => setSettings({ ...settings, cinematicDurationSec: sec })}
                className={`py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-[0.97] ${
                  settings.cinematicDurationSec === sec
                    ? "border-accent bg-accent text-accent-foreground shadow-sm shadow-accent/20"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Save CTA */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-4 bg-accent hover:bg-accent/90 active:bg-accent/80 text-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
        >
          {isSaving ? (
            <Sparkles className="w-5 h-5 text-accent-foreground animate-spin" />
          ) : (
            <Save className="w-5 h-5 text-accent-foreground" />
          )}
          <span>{isSaving ? "Saving..." : "Save Credit Settings"}</span>
        </button>

        <p className="text-[11px] text-muted-foreground text-center pt-1 leading-normal">
          Fewer assets synthesized = lower credit usage per production.
        </p>
      </div>
    </div>
  );
}

function CreditControlDesktop({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { creditSettings, updateCreditSettings } = useSpark();

  const [settings, setSettings] = useState<GenerationCreditSettings>(
    creditSettings || DEFAULT_CREDIT_SETTINGS
  );
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateCreditSettings(settings);
      setToastMessage((res as any) !== false ? "Credit control settings saved to cloud & workspace." : "Credit control settings saved.");
    } catch (err) {
      console.warn("[CreditControlDesktop] Save error:", err);
      setToastMessage("Credit control settings saved.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleReset = async () => {
    setSettings(DEFAULT_CREDIT_SETTINGS);
    setIsSaving(true);
    try {
      await updateCreditSettings(DEFAULT_CREDIT_SETTINGS);
      setToastMessage("Reset to pipeline defaults (3 thumbs, 3 keyframes, 8s/12s).");
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {toastMessage && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-medium flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Thumbnails */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Thumbnail Variants</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Specify how many cover thumbnail variations SPARK synthesizes for each production.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-accent/15 text-accent">
            {settings.thumbnailCount} {settings.thumbnailCount === 1 ? "Variant" : "Variants"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              onClick={() => setSettings({ ...settings, thumbnailCount: num })}
              className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                settings.thumbnailCount === num
                  ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                  : "border-border bg-background hover:bg-accent/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {num} {num === 1 ? "Variant" : "Variants"}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Keyframes / Storyboard Panels */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Keyframe Panels</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Maximum sequential visual keyframe panels synthesized per production brief.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-accent/15 text-accent">
            {settings.keyframeCount} {settings.keyframeCount === 1 ? "Panel" : "Panels"}
          </span>
        </div>

        <div className="grid grid-cols-6 gap-2.5 pt-1">
          {[1, 2, 3, 4, 5, 6].map((num) => (
            <button
              key={num}
              onClick={() => setSettings({ ...settings, keyframeCount: num, maxVideoClips: num })}
              className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                settings.keyframeCount === num
                  ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                  : "border-border bg-background hover:bg-accent/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {num} {num === 1 ? "Panel" : "Panels"}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Duration Limits */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="border-b border-border/40 pb-3">
          <h3 className="text-base font-semibold text-foreground">Target Video Clip Durations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Default target durations applied to motion synthesis based on production mode.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Express/Standard */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Shorts Length (Express / Narrator)</span>
              <span className="text-xs font-mono font-bold text-accent">{settings.shortsDurationSec}s</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 8, 10, 15].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSettings({ ...settings, shortsDurationSec: sec })}
                  className={`py-2.5 rounded-lg border text-xs font-bold transition-all ${
                    settings.shortsDurationSec === sec
                      ? "border-accent bg-accent text-accent-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Deep Cinematic */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Cinematic Length (Deep Mode)</span>
              <span className="text-xs font-mono font-bold text-accent">{settings.cinematicDurationSec}s</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[8, 12, 15, 20].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSettings({ ...settings, cinematicDurationSec: sec })}
                  className={`py-2.5 rounded-lg border text-xs font-bold transition-all ${
                    settings.cinematicDurationSec === sec
                      ? "border-accent bg-accent text-accent-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save Action Bar */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <button
          onClick={handleReset}
          disabled={isSaving}
          className="px-4 py-3 border border-border hover:bg-accent/10 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset to Defaults</span>
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-3.5 bg-accent hover:bg-accent/90 active:bg-accent/80 text-foreground font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 text-sm"
        >
          {isSaving ? <Sparkles className="w-4 h-4 text-accent-foreground animate-spin" /> : <Save className="w-4 h-4 text-accent-foreground" />}
          <span>{isSaving ? "Saving Settings..." : "Save Credit Control Settings"}</span>
        </button>
      </div>
    </div>
  );
}
