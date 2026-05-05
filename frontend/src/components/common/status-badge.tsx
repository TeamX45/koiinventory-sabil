import { cn } from "@/lib/utils";
import type { StatusVariant } from "./status-maps";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

// Translasi status backend → label bahasa Indonesia
const STATUS_LABELS: Record<string, string> = {
  // Generic
  draft: "Draf",
  pending: "Menunggu",
  active: "Aktif",
  cancelled: "Dibatalkan",
  completed: "Selesai",
  depleted: "Habis",
  archived: "Diarsipkan",
  // Purchases
  received: "Diterima",
  sorted: "Disortir",
  // Harvests
  harvested: "Dipanen",
  // Sales
  paid: "Lunas",
  shipped: "Dikirim",
};

const variantClasses: Record<StatusVariant, string> = {
  default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  secondary:
    "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
};

const dotClasses: Record<StatusVariant, string> = {
  default: "bg-slate-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-blue-500",
  secondary: "bg-violet-500",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
};

export function StatusBadge({
  status,
  variant = "default",
  size = "md",
  dot = true,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotClasses[variant])}
        />
      )}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
