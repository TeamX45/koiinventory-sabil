import { cn } from "@/lib/utils";
import { Package, Search, FileX, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateVariant = "default" | "search" | "error" | "no-data";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const defaultContent: Record<
  EmptyStateVariant,
  { icon: React.ReactNode; title: string; description: string }
> = {
  default: {
    icon: <Package className="h-12 w-12" />,
    title: "Tidak ada data",
    description: "Belum ada data yang tersedia saat ini.",
  },
  search: {
    icon: <Search className="h-12 w-12" />,
    title: "Tidak ditemukan",
    description: "Tidak ada hasil yang cocok dengan pencarian Anda.",
  },
  error: {
    icon: <FileX className="h-12 w-12" />,
    title: "Terjadi kesalahan",
    description: "Gagal memuat data. Silakan coba lagi.",
  },
  "no-data": {
    icon: <Package className="h-12 w-12" />,
    title: "Belum ada data",
    description: "Mulai dengan menambahkan data baru.",
  },
};

export function EmptyState({
  variant = "default",
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const content = defaultContent[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground/50">
        {icon || content.icon}
      </div>
      <h3 className="mb-1 text-lg font-semibold text-foreground">
        {title || content.title}
      </h3>
      <p className="mb-6 max-w-sm text-[14px] text-muted-foreground">
        {description || content.description}
      </p>
      {action && (
        <Button onClick={action.onClick} className="gap-2">
          <Plus className="h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
