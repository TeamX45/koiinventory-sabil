import { cn } from "@/lib/utils";

type GlassVariant = "default" | "elevated" | "subtle";
type GradientColor =
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "blue"
  | "cyan"
  | "none";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  gradient?: GradientColor;
  glow?: boolean;
  noPadding?: boolean;
}

const variantClasses: Record<GlassVariant, string> = {
  default: "glass",
  elevated: "glass-elevated",
  subtle: "glass-subtle",
};

const gradientClasses: Record<GradientColor, string> = {
  violet: "gradient-violet",
  emerald: "gradient-emerald",
  amber: "gradient-amber",
  rose: "gradient-rose",
  blue: "gradient-blue",
  cyan: "gradient-cyan",
  none: "",
};

const glowClasses: Record<GradientColor, string> = {
  violet: "glow-violet",
  emerald: "glow-emerald",
  amber: "glow-amber",
  rose: "glow-rose",
  blue: "glow-blue",
  cyan: "",
  none: "",
};

export function GlassCard({
  className,
  variant = "default",
  gradient = "none",
  glow = false,
  noPadding = false,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "ring-1 ring-black/5 dark:ring-white/5",
        "transition-all duration-300",
        variantClasses[variant],
        gradientClasses[gradient],
        glow && glowClasses[gradient],
        !noPadding && "p-6",
        className
      )}
      {...props}
    >
      {/* Inner glow effect */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-white/10 to-transparent dark:from-white/5" />

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}

// Specialized stat card variant
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: GradientColor;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "violet",
  className,
}: StatCardProps) {
  const iconColorClasses: Record<GradientColor, string> = {
    violet: "from-violet-500 to-indigo-600 shadow-violet-500/25",
    emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/25",
    amber: "from-amber-500 to-orange-600 shadow-amber-500/25",
    rose: "from-rose-500 to-pink-600 shadow-rose-500/25",
    blue: "from-blue-500 to-cyan-600 shadow-blue-500/25",
    cyan: "from-cyan-500 to-teal-600 shadow-cyan-500/25",
    none: "from-slate-500 to-slate-600 shadow-slate-500/25",
  };

  return (
    <GlassCard gradient={color} className={cn("group", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-medium text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-[12px] text-muted-foreground/70">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn(
                  "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  trend.isPositive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}
              >
                <svg
                  className={cn("h-3 w-3", !trend.isPositive && "rotate-180")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
                {Math.abs(trend.value)}%
              </span>
              <span className="text-[11px] text-muted-foreground/60">
                vs bulan lalu
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-lg transition-transform duration-300 group-hover:scale-110",
              iconColorClasses[color]
            )}
          >
            <div className="text-white">{icon}</div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
