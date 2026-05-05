import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Ruler, Clock } from "lucide-react";
import { PondsApi } from "@/api/endpoints";
import {
  PageHeader,
  GlassCard,
  DataTable,
  type Column,
} from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber, formatRp } from "@/utils/format";
import type { Batch } from "@/types/models";

export default function PondDetailPage() {
  const { id } = useParams();
  const pondId = Number(id);

  const { data: pond, isLoading } = useQuery({
    queryKey: ["pond", pondId],
    queryFn: () => PondsApi.get(pondId),
  });
  const { data: batches, isLoading: bLoading } = useQuery({
    queryKey: ["pond-batches", pondId],
    queryFn: () => PondsApi.batches(pondId),
  });

  if (isLoading || !pond) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  const totalStock =
    batches?.reduce((s, b) => s + b.current_count, 0) ?? 0;
  const valuation =
    batches?.reduce(
      (s, b) => s + b.current_count * Number(b.price_per_fish ?? 0),
      0
    ) ?? 0;

  const columns: Column<Batch>[] = [
    {
      key: "code",
      header: "Kode",
      cell: (row) => (
        <span className="font-mono text-[12px] font-medium">{row.code}</span>
      ),
    },
    {
      key: "source_type",
      header: "Sumber",
      cell: (row) => (
        <Badge
          variant={
            row.source_type === "sorting"
              ? "secondary"
              : row.source_type === "purchase"
              ? "default"
              : "outline"
          }
        >
          {row.source_type}
        </Badge>
      ),
    },
    {
      key: "grade",
      header: "Grade",
      cell: (row) =>
        row.grade ? (
          <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:text-emerald-400">
            {row.grade.name}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-200 text-amber-700 dark:text-amber-400">
            unsorted
          </Badge>
        ),
    },
    {
      key: "current_count",
      header: "Stok",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => formatNumber(row.current_count),
    },
    {
      key: "price_per_fish",
      header: "Harga/ekor",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => formatRp(row.price_per_fish),
    },
    {
      key: "entry_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDate(row.entry_date)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        to="/ponds"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar kolam
      </Link>

      <PageHeader
        title={pond.name}
        description={`${pond.location?.name ?? ""}${pond.category?.name ? " · " + pond.category.name : ""}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard gradient="cyan">
          <h2 className="font-semibold text-foreground">Info</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-2 items-center text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-cyan-500" />
              {pond.location?.name}
            </li>
            <li>
              <Badge variant="secondary">{pond.category?.name}</Badge>
            </li>
            {pond.target_min_size_cm && pond.target_max_size_cm && (
              <li className="flex gap-2 items-center text-muted-foreground">
                <Ruler className="h-3.5 w-3.5 text-cyan-500" />
                {pond.target_min_size_cm}–{pond.target_max_size_cm} cm
              </li>
            )}
            {pond.grow_duration_months && (
              <li className="flex gap-2 items-center text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-cyan-500" />
                ~{pond.grow_duration_months} bulan
              </li>
            )}
          </ul>
        </GlassCard>

        <GlassCard gradient="emerald">
          <h2 className="font-semibold text-foreground">Stok Aktif</h2>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {formatNumber(totalStock)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ekor di {batches?.length ?? 0} batch aktif
          </div>
        </GlassCard>

        <GlassCard gradient="amber">
          <h2 className="font-semibold text-foreground">Estimasi Nilai</h2>
          <div className="mt-2 text-2xl font-bold text-gradient-amber">
            {formatRp(valuation)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Stok × harga per ekor
          </div>
        </GlassCard>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">
          Batch di Kolam Ini
        </h3>
        <DataTable
          data={batches ?? []}
          columns={columns}
          keyExtractor={(b) => String(b.id)}
          isLoading={bLoading}
          emptyMessage="Belum ada batch aktif di kolam ini."
        />
      </div>
    </div>
  );
}
