import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types/models";
import { formatNumber } from "@/utils/format";

interface PaginationProps {
  meta: PaginationMeta | undefined;
  page: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, page, onPageChange }: PaginationProps) {
  if (!meta || meta.last_page <= 1) return null;

  const { current_page, last_page, total, per_page } = meta;
  const startRow = (current_page - 1) * per_page + 1;
  const endRow = Math.min(current_page * per_page, total);

  return (
    <div className="flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-[12px] text-muted-foreground">
        Menampilkan{" "}
        <span className="font-medium text-foreground">{formatNumber(startRow)}</span>
        –<span className="font-medium text-foreground">{formatNumber(endRow)}</span>
        {" "}dari{" "}
        <span className="font-medium text-foreground">{formatNumber(total)}</span>
        {" "}data
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Sebelum
        </Button>

        <div className="text-[12px] tabular-nums">
          Hal <span className="font-semibold">{current_page}</span>
          {" / "}
          <span className="text-muted-foreground">{last_page}</span>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={page >= last_page}
          onClick={() => onPageChange(page + 1)}
        >
          Sesudah
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
