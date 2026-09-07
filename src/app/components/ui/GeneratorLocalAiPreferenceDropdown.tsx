import {
  IMAGE_AI_PROVIDER_OPTIONS,
  listImageModelsForProvider,
  type GeneratorLocalAiPreference,
} from "../../services/runtime/generatorLocalAiPreference";
import type { AIProviderId } from "../../domain/types";

interface GeneratorLocalAiPreferenceDropdownProps {
  value: GeneratorLocalAiPreference;
  onChange: (next: GeneratorLocalAiPreference) => void;
  /** Label context for accessibility / helper copy */
  generatorLabel?: string;
  compact?: boolean;
}

/**
 * Per-generator image AI preference. Writes only through the parent callback
 * into generator-local storage — never formatSettings or aiSettings.
 */
export function GeneratorLocalAiPreferenceDropdown({
  value,
  onChange,
  generatorLabel = "this generator",
  compact = true,
}: GeneratorLocalAiPreferenceDropdownProps) {
  const provider = value.providerId || "auto";
  const isAuto = provider === "auto";
  const models = listImageModelsForProvider(provider);
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
          This generator only
        </span>
      </div>

      <div className={`flex ${compact ? "flex-col" : "flex-col sm:flex-row sm:flex-wrap"} gap-2`}>
        <select
          aria-label={`Image AI provider for ${generatorLabel}`}
          value={provider}
          onChange={(e) =>
            onChange({
              providerId: e.target.value as AIProviderId | "auto",
              modelId: e.target.value === "auto" ? undefined : value.modelId,
            })
          }
          className={selectClass}
        >
          {IMAGE_AI_PROVIDER_OPTIONS.map((opt) => (
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
            aria-label={`Image AI model for ${generatorLabel}`}
            value={value.modelId || ""}
            onChange={(e) =>
              onChange({
                providerId: provider,
                modelId: e.target.value || undefined,
              })
            }
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
        Applies only to {generatorLabel} generate / regenerate. Does not change SPARK production AI
        preference or the clip pipeline.
      </p>
    </div>
  );
}
