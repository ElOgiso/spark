import { useInstallPrompt } from "../pwa/useInstallPrompt";
import { Sparkles, Download, X, Share2, Plus } from "lucide-react";

export function InstallPrompt() {
  const { isInstallable, isIOS, promptToInstall, dismissPrompt } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-card border border-border/80 rounded-xl p-5 shadow-2xl shadow-black/60 relative overflow-hidden">
        {/* Decorative ambient background accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-start gap-3.5 pr-6">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0 border border-accent/25">
            <Sparkles className="w-5 h-5 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              Install Spark OS
            </h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Experience the AI Media Operating System as a native app with offline capability and instant notifications.
            </p>
          </div>
        </div>

        {/* Content for iOS vs Standard */}
        {isIOS ? (
          <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border/40 text-xs text-muted-foreground space-y-2.5">
            <p className="font-medium text-foreground">To install on iOS:</p>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-accent/15 text-accent-foreground flex items-center justify-center font-bold text-[10px]">
                1
              </span>
              <span className="flex items-center gap-1.5">
                Tap the Share button <Share2 className="w-3.5 h-3.5 text-accent-foreground" />
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-accent/15 text-accent-foreground flex items-center justify-center font-bold text-[10px]">
                2
              </span>
              <span className="flex items-center gap-1.5">
                Select <Plus className="w-3.5 h-3.5 text-accent-foreground" /> Add to Home Screen
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2.5">
            <button
              onClick={promptToInstall}
              className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Install App
            </button>
            <button
              onClick={dismissPrompt}
              className="px-3 py-2 rounded-lg border border-border/50 hover:bg-accent/10 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
            >
              Maybe Later
            </button>
          </div>
        )}

        {/* Dismiss icon button */}
        <button
          onClick={dismissPrompt}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-all"
          aria-label="Dismiss installation prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
