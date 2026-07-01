import { LucideIcon } from "lucide-react";

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    positive?: boolean;
  };
  variant?: "default" | "success" | "warning" | "destructive";
}

export function StatusCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
}: StatusCardProps) {
  const variantStyles = {
    default: "bg-card border-border",
    success: "bg-card border-success/20",
    warning: "bg-card border-warning/20",
    destructive: "bg-card border-destructive/20",
  };

  return (
    <div
      className={`
        rounded-xl border p-8
        ${variantStyles[variant]}
        transition-all duration-200 hover:shadow-xl hover:shadow-black/10
      `}
    >
      <div className="flex items-start justify-between mb-6">
        <p className="text-sm text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        {Icon && (
          <div className="rounded-lg bg-accent/30 p-2.5">
            <Icon className="w-5 h-5 text-foreground/90" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <h3 className="text-4xl font-medium tracking-tight">{value}</h3>
        {trend && (
          <span
            className={`text-sm font-medium ${
              trend.positive ? "text-success" : "text-destructive"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
