/**
 * Spark Design System
 * Shared primitive components for consistent UI across all screens.
 *
 * Typography hierarchy:
 *  - Product title (nav):   text-lg font-medium
 *  - Page title:            text-3xl font-medium
 *  - Section label:         text-xs font-medium uppercase tracking-wide text-muted-foreground
 *  - Card title:            text-base font-medium
 *  - Body:                  text-sm
 *  - Meta:                  text-xs text-muted-foreground
 *  - Button:                text-sm font-medium
 *  - Bottom nav label:      text-[11px] font-medium
 *
 * Spacing tokens:
 *  - Screen padding desktop:  p-8 (32px)
 *  - Screen padding mobile:   px-4 pt-6 pb-24
 *  - Card padding desktop:    p-6
 *  - Card padding mobile:     p-4
 *  - Section gap desktop:     space-y-8
 *  - Section gap mobile:      space-y-5
 *  - Card grid gap desktop:   gap-4 or gap-6
 *  - Card grid gap mobile:    gap-3
 */

import React, { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Loader2, CheckCircle2, AlertTriangle, Clock, Package,
  Calendar, XCircle, Zap, Flame, TrendingUp, Sparkles,
  ChevronDown, ChevronUp, ShieldCheck, AlertCircle, Info,
} from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Button ──────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | "primary"    // bg-foreground — main CTA
  | "secondary"  // bg-accent — supporting action
  | "accent"     // legacy export alias for secondary
  | "outline"    // bordered neutral action
  | "ghost"      // transparent — tertiary
  | "danger"     // destructive tint — delete/reject
  | "approve"    // bg-success — approve/publish
  | "regenerate" // accent tint — regenerate/retry
  | "schedule";  // same as secondary — schedule/export

export type ButtonSize = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:    "bg-foreground text-background hover:bg-foreground/90 shadow-lg shadow-black/20 active:scale-[0.98]",
  secondary:  "bg-accent hover:bg-accent/80 text-foreground active:scale-[0.98]",
  accent:     "bg-accent hover:bg-accent/80 text-foreground active:scale-[0.98]",
  outline:    "border border-border bg-transparent text-foreground hover:bg-accent/20 active:scale-[0.98]",
  ghost:      "text-muted-foreground hover:text-foreground hover:bg-accent/20 active:scale-[0.98]",
  danger:     "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 active:scale-[0.98]",
  approve:    "bg-success hover:bg-success/90 text-white shadow-lg shadow-success/10 active:scale-[0.98]",
  regenerate: "bg-accent/30 hover:bg-accent/50 text-foreground active:scale-[0.98]",
  schedule:   "bg-accent hover:bg-accent/80 text-foreground active:scale-[0.98]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm:  "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md:  "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg:  "px-5 py-3 text-sm rounded-xl gap-2",
  xl:  "px-6 py-4 text-base rounded-xl gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  fullWidth,
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200 select-none",
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && "w-full",
        (disabled || loading) && "opacity-50 cursor-not-allowed pointer-events-none",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Status Chip ─────────────────────────────────────────────────────────────

export type ChipVariant =
  | "drafting"
  | "ready"
  | "needs-edit"
  | "approved"
  | "scheduled"
  | "export-ready"
  | "published"
  | "failed"
  | "high-fit"
  | "medium-risk"
  | "low-risk"
  | "brand-safe"
  | "needs-attention"
  | "hot"
  | "rising"
  | "in-production";

interface ChipConfig {
  label: string;
  className: string;
  icon?: React.ComponentType<{ className?: string }>;
  animated?: boolean;
}

const chipConfig: Record<ChipVariant, ChipConfig> = {
  drafting:         { label: "Drafting",          className: "bg-muted/30 text-muted-foreground border-border/40",       icon: Loader2, animated: true },
  ready:            { label: "Ready for Review",  className: "bg-warning/10 text-warning border-warning/25" },
  "needs-edit":     { label: "Needs Edit",        className: "bg-destructive/10 text-destructive border-destructive/25" },
  approved:         { label: "Approved",          className: "bg-success/10 text-success border-success/25",             icon: CheckCircle2 },
  scheduled:        { label: "Scheduled",         className: "bg-accent/20 text-accent-foreground border-accent/35",     icon: Calendar },
  "export-ready":   { label: "Export Ready",      className: "bg-accent/15 text-accent-foreground border-accent/25",    icon: Package },
  published:        { label: "Published",         className: "bg-success/10 text-success border-success/20",            icon: CheckCircle2 },
  failed:           { label: "Failed",            className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  "high-fit":       { label: "High Fit",          className: "bg-success/10 text-success border-success/20" },
  "medium-risk":    { label: "Medium Risk",       className: "bg-warning/10 text-warning border-warning/20" },
  "low-risk":       { label: "Low Risk",          className: "bg-success/10 text-success border-success/15" },
  "brand-safe":     { label: "Brand Safe",        className: "bg-success/10 text-success border-success/15",            icon: CheckCircle2 },
  "needs-attention":{ label: "Needs Attention",   className: "bg-warning/10 text-warning border-warning/20",            icon: AlertTriangle },
  hot:              { label: "Hot",               className: "bg-destructive/10 text-destructive border-destructive/20", icon: Flame },
  rising:           { label: "Rising",            className: "bg-warning/10 text-warning border-warning/20",            icon: TrendingUp },
  "in-production":  { label: "In Production",     className: "bg-success/10 text-success border-success/20",            icon: Zap },
};

interface StatusChipProps {
  variant: ChipVariant;
  label?: string;
  className?: string;
}

export function StatusChip({ variant, label, className }: StatusChipProps) {
  const cfg = chipConfig[variant];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        cfg.className,
        className,
      )}
    >
      {Icon && (
        <Icon className={cn("w-3 h-3", cfg.animated && "animate-spin")} />
      )}
      {label ?? cfg.label}
    </span>
  );
}

// ─── Score Badge ─────────────────────────────────────────────────────────────

interface ScoreBadgeProps {
  score: number;
  label?: string;
  large?: boolean;
}

export function ScoreBadge({ score, label = "fit", large }: ScoreBadgeProps) {
  const color = score >= 90 ? "text-success" : score >= 75 ? "text-warning" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-1">
      <span className={cn(large ? "text-2xl" : "text-xl", "font-medium", color)}>
        {score}%
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Confidence Bar ───────────────────────────────────────────────────────────

interface ConfidenceBarProps {
  value: number;
  showLabel?: boolean;
  width?: string;
}

export function ConfidenceBar({ value, showLabel = true, width = "w-16" }: ConfidenceBarProps) {
  const color = value >= 80 ? "bg-success" : value >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className={cn(width, "h-1.5 bg-muted rounded-full overflow-hidden")}>
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      {showLabel && <span className="text-xs text-muted-foreground">{value}%</span>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

type CardVariant = "default" | "success" | "warning" | "danger" | "accent" | "muted";

const cardVariants: Record<CardVariant, string> = {
  default:  "border-border bg-card",
  success:  "border-success/25 bg-success/5",
  warning:  "border-warning/25 bg-warning/5",
  danger:   "border-destructive/25 bg-destructive/5",
  accent:   "border-accent/40 bg-accent/10",
  muted:    "border-border/50 bg-background/50",
};

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  interactive?: boolean;
  onClick?: () => void;
  padding?: "sm" | "md" | "lg" | "none";
}

const cardPadding = { sm: "p-4", md: "p-5", lg: "p-6 lg:p-8", none: "" };

export function Card({
  children,
  className,
  variant = "default",
  interactive,
  onClick,
  padding = "md",
}: CardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-xl border",
        cardVariants[variant],
        cardPadding[padding],
        interactive && "hover:border-accent/40 hover:shadow-xl hover:shadow-black/10 transition-all duration-200",
        onClick && "w-full text-left cursor-pointer active:scale-[0.99] transition-all",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-10 px-6" : "py-16 px-8")}>
      {icon && (
        <div className="w-11 h-11 rounded-full bg-muted/30 border border-border flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[260px] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  meta?: string;
}

export function PageHeader({ title, subtitle, action, meta }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="text-3xl font-medium">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {meta && <span className="text-sm text-muted-foreground">{meta}</span>}
        {action}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
  meta?: string;
  className?: string;
}

export function SectionHeader({ label, action, meta, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      <div className="flex items-center gap-3">
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        {action}
      </div>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  icon?: React.ReactNode;
  highlight?: boolean;
  onClick?: () => void;
}

export function MetricCard({
  title, value, subtitle, trend, trendPositive = true, icon, highlight, onClick,
}: MetricCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-xl border p-5 bg-card transition-all duration-200 hover:shadow-xl hover:shadow-black/10 text-left",
        highlight ? "border-success/20" : "border-border",
        onClick && "cursor-pointer active:scale-[0.98] w-full"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">{title}</p>
        {icon && <div className="rounded-lg bg-accent/30 p-1.5">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-medium tracking-tight">{value}</h3>
        {trend && (
          <span className={cn("text-xs font-medium", trendPositive ? "text-success" : "text-destructive")}>
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>}
    </Comp>
  );
}

// ─── Loading State ────────────────────────────────────────────────────────────

interface LoadingStateProps {
  message?: string;
  compact?: boolean;
}

export function LoadingState({ message = "Loading…", compact }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-16")}>
      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Success State ────────────────────────────────────────────────────────────

interface SuccessStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SuccessState({ title, description, action }: SuccessStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-8">
      <div className="w-14 h-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-7 h-7 text-success" />
      </div>
      <p className="text-xl font-medium mb-2">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </div>
  );
}

// ─── Inline Alert ─────────────────────────────────────────────────────────────

type AlertVariant = "info" | "warning" | "danger" | "success";

interface InlineAlertProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const alertStyles: Record<AlertVariant, string> = {
  info:    "bg-accent/10 border-accent/25 text-accent-foreground",
  warning: "bg-warning/10 border-warning/25 text-warning",
  danger:  "bg-destructive/10 border-destructive/25 text-destructive",
  success: "bg-success/10 border-success/25 text-success",
};

export function InlineAlert({ variant = "info", children, icon }: InlineAlertProps) {
  return (
    <div className={cn("flex items-start gap-3 p-3.5 rounded-xl border text-sm", alertStyles[variant])}>
      {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

// ─── Mobile Tap Row ───────────────────────────────────────────────────────────

interface TapRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  last?: boolean;
}

export function TapRow({ children, onClick, className, last }: TapRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-5 py-4 text-left",
        "hover:bg-accent/5 active:bg-accent/10 transition-colors",
        !last && "border-b border-border/50",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── Filter Pill ─────────────────────────────────────────────────────────────

interface FilterPillProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export function FilterPill({ label, count, active, onClick, icon }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
        active
          ? "bg-accent text-foreground"
          : "bg-card border border-border text-muted-foreground hover:bg-accent/20 hover:text-foreground",
      )}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={cn("text-xs px-1.5 py-0.5 rounded", active ? "bg-background/40" : "bg-muted/50")}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Why Spark Recommends This ───────────────────────────────────────────────

export type ConfidenceLevel = "Low" | "Medium" | "High" | "Very High";
export type RiskLevel = "Low" | "Medium" | "High";

export interface RecommendationDetails {
  reason: string;
  evidence: string[];
  confidence: ConfidenceLevel;
  confidencePercent?: number;
  expectedOutcome: string;
  risk: RiskLevel;
  nextBestAction?: string;
  brandRules?: string[];
}

interface WhySparkRecommendsProps {
  details: RecommendationDetails;
  defaultExpanded?: boolean;
}

export function WhySparkRecommends({ details, defaultExpanded = false }: WhySparkRecommendsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const confidenceColors: Record<ConfidenceLevel, { text: string; bg: string; border: string }> = {
    "Low": { text: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
    "Medium": { text: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
    "High": { text: "text-success", bg: "bg-success/10", border: "border-success/20" },
    "Very High": { text: "text-success font-semibold", bg: "bg-success/20", border: "border-success/30" },
  };

  const riskColors: Record<RiskLevel, { text: string; bg: string; border: string }> = {
    "Low": { text: "text-success", bg: "bg-success/5", border: "border-success/15" },
    "Medium": { text: "text-warning", bg: "bg-warning/5", border: "border-warning/15" },
    "High": { text: "text-destructive", bg: "bg-destructive/5", border: "border-destructive/15" },
  };

  const confStyle = confidenceColors[details.confidence] || confidenceColors["High"];
  const riskStyle = riskColors[details.risk] || riskColors["Low"];

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-accent/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-foreground animate-pulse" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">Why Spark Recommends This</span>
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border bg-muted/30 text-muted-foreground border-border/40">
              Confidence: <span className={confStyle.text}>{details.confidence} {details.confidencePercent ? `(${details.confidencePercent}%)` : ""}</span>
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/30 space-y-3 text-xs leading-relaxed">
          {/* Main Strategic Reason */}
          <div>
            <p className="font-semibold text-foreground/90 mb-1">Strategic Rationale</p>
            <p className="text-muted-foreground font-light">{details.reason}</p>
          </div>

          {/* Evidence Checklist */}
          {details.evidence && details.evidence.length > 0 && (
            <div>
              <p className="font-semibold text-muted-foreground/80 uppercase tracking-wider text-[9px] mb-1.5">Evidence & Past Learning</p>
              <ul className="space-y-1">
                {details.evidence.map((item, index) => (
                  <li key={index} className="flex items-start gap-1.5 text-foreground/85 font-light">
                    <span className="text-success mt-0.5 font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Brand rules influenced */}
          {details.brandRules && details.brandRules.length > 0 && (
            <div>
              <p className="font-semibold text-muted-foreground/80 uppercase tracking-wider text-[9px] mb-1">Influenced Brand Authority Rules</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {details.brandRules.map((rule, idx) => (
                  <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent-foreground font-medium">
                    🏷️ {rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk, Expected Outcome & Next Best Action Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-border/20">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Expected Outcome</p>
              <p className="text-foreground/95 font-medium mt-0.5">{details.expectedOutcome}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Risk Rating</p>
              <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded border text-[11px] font-semibold ${riskStyle.text} ${riskStyle.bg} ${riskStyle.border}`}>
                {details.risk} Risk
              </span>
            </div>
          </div>

          {details.nextBestAction && (
            <div className="pt-2.5 border-t border-border/10 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Strategic Action:</span>
              <span className="font-semibold text-accent-foreground bg-accent/10 px-2.5 py-1 rounded-lg text-[11px] border border-accent/20">
                👉 {details.nextBestAction}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
