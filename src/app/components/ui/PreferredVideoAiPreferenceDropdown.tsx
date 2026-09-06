import {
  VIDEO_AI_PROVIDER_OPTIONS,
  listVideoModelsForProvider,
} from "../../services/runtime/preferredVideoAiPreference";
import type { AIProviderId } from "../../domain/types";

interface PreferredVideoAiPreferenceDropdownProps {
  preferredVideoProvider?: AIProviderId | "auto";
  preferredVideoModel?: string;
  onProviderChange: (providerId: AIProviderId | "auto") => void;
  onModelChange: (modelId: string) => void;
  /** Slightly tighter layout for mobile My Spark */
  compact?: boolean;
}

/**
 * Compact AI preference dropdowns for My Spark generator / clip-engine controls.
 * Matches More → AI Preferences select styling; writes through parent handlers
 * into formatSettings + aiSettings (same spine production already respects).
 */
export function PreferredVideoAiPreferenceDropdown({
  preferredVideoProvider,
  preferredVideoModel,
  onProviderChange,
  onModelChange,
  compact = false,
}: PreferredVideoAiPreferenceDropdownProps) {
  const provider = preferredVideoProvider || "auto";
  const isAuto = provider === "auto";
  const models = listVideoModelsForProvider(provider);
  const selectClass = compact
    ? "w-full bg-input-background border border-border text-xs text-foreground font-semibold px-3 py-2 rounded-xl outline-none focus:border-purple-500 cursor-pointer"
    : "bg-input-background border border-border text-xs text-foreground font-semibold px-3 py-2 rounded-xl outline-none focus:border-purple-500 cursor-pointer min-w-[180px]";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          AI Preference
        </p>
        <span className="text-[11px] font-mono text-muted-foreground">
          Provider & Model
        </span>
      </div>

      <div className={`flex ${compact ? "flex-col" : "flex-col sm:flex-row sm:flex-wrap"} gap-2`}>
        <select
          aria-label="Preferred video AI provider"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as AIProviderId | "auto")}
          className={selectClass}
        >
          {VIDEO_AI_PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        {isAuto ? (
          <div
            className={`${compact ? "w-full" : "min-w-[180px]"} px-3 py-2 text-[11px] text-muted-foreground bg-muted/20 border border-border/40 rounded-xl font-mono text-center select-none`}
          >
            Auto Model Managed
          </div>
        ) : models.length > 0 ? (
          <select
            aria-label="Preferred video AI model"
            value={preferredVideoModel || ""}
            onChange={(e) => onModelChange(e.target.value)}
            className={
              compact
                ? "w-full bg-input-background border border-border text-xs text-foreground px-3 py-2 rounded-xl outline-none focus:border-purple-500 cursor-pointer"
                : "bg-input-background border border-border text-xs text-foreground px-3 py-2 rounded-xl outline-none focus:border-purple-500 cursor-pointer min-w-[200px]"
            }
          >
            <option value="">Recommended default</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.recommended ? " ★" : ""}
              </option>
            ))}
          </select>
        ) : (
          <div
            className={`${compact ? "w-full" : "min-w-[180px]"} px-3 py-2 text-[11px] text-muted-foreground bg-muted/20 border border-border/40 rounded-xl font-mono text-center select-none`}
          >
            Provider default model
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Pins the clip engine used for generation. Same setting as production format / snapshot.
      </p>
    </div>
  );
}
