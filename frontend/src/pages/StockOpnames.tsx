import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Trash2,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  X,
  FishIcon,
} from "lucide-react";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import {
  StockOpnamesApi,
  LocationsApi,
  MasterApi,
  PondsApi,
  downloadCsv,
  type StockOpnameBulkRow,
} from "@/api/endpoints";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  GlassCard,
  Pagination,
  type Column,
} from "@/components/common";
import type { StatusVariant } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDate,
  formatNumber,
  formatSize,
} from "@/utils/format";
import type { StockOpname, Batch } from "@/types/models";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "warning",
  completed: "success",
  cancelled: "danger",
};

/** Baris untuk batch yang sudah tercatat — tinggal dicocokkan jumlahnya. */
interface ExistingRow {
  kind: "existing";
  batch_id: number;
  current_count: number;
  actual_count: number | null;
}

/**
 * Baris untuk ikan yang ditemukan di kolam tapi belum ada di sistem. Belum
 * punya batch — server yang membuatkannya saat opname diselesaikan.
 */
interface NewRow {
  kind: "new";
  key: string;
  fish_type_id: number | null;
  grade_id: number | null;
  size_cm: number | null;
  actual_count: number | null;
}

type RowDraft = ExistingRow | NewRow;

let newRowSeq = 0;

const emptyNewRow = (): NewRow => ({
  kind: "new",
  key: `baru-${++newRowSeq}`,
  fish_type_id: null,
  grade_id: null,
  size_cm: null,
  actual_count: null,
});

export default function StockOpnamesPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["stock-opnames", { page }],
    queryFn: () => StockOpnamesApi.list({ page }),
    placeholderData: (prev) => prev,
  });
  const opnames = data?.data ?? [];
  const meta = data?.meta;

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: LocationsApi.list,
  });
  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });
  const { data: fishTypes = [] } = useQuery({
    queryKey: ["fish-types"],
    queryFn: MasterApi.fishTypes,
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: MasterApi.grades,
  });

  // Modal state
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState(0);
  const [pondId, setPondId] = useState(0);
  const [opnameDate, setOpnameDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<RowDraft[]>([]);

  const { data: pondBatches } = useQuery({
    queryKey: ["pond-batches", pondId],
    queryFn: () => PondsApi.batches(pondId),
    enabled: pondId > 0,
  });


  const availableLocations = useMemo(() => {
    if (!locations) return [];
    return [...locations].sort((a, b) => a.name.localeCompare(b.name));
  }, [locations]);

  const availablePonds = useMemo(() => {
    if (!ponds || !locationId) return [];
    return ponds
      .filter((p) => p.location_id === locationId && p.is_active !== false)
      .map((p) => ({
        id: p.id,
        name: p.name,
        total: p.current_stock ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ponds, locationId]);

  const batchesById = useMemo(() => {
    const m = new Map<number, Batch>();
    (pondBatches ?? []).forEach((b) => m.set(b.id, b));
    return m;
  }, [pondBatches]);

  // Total selisih live
  const totals = useMemo(() => {
    let system = 0;
    let actual = 0;
    let filled = 0;
    rows.forEach((r) => {
      // Baris temuan fisik belum tercatat di sistem, jadi sisi "sistem"-nya nol.
      system += r.kind === "existing" ? r.current_count : 0;
      if (r.actual_count !== null) {
        actual += r.actual_count;
        filled += 1;
      }
    });
    return { system, actual, diff: actual - system, filled };
  }, [rows]);

  // Bulk submit: 1 endpoint atomic — sukses semua atau rollback semua
  const create = useMutation({
    mutationFn: async () => {
      const payload: StockOpnameBulkRow[] = rows
        .filter((r) => r.actual_count !== null)
        .map((r) =>
          r.kind === "existing"
            ? { batch_id: r.batch_id, actual_count: r.actual_count! }
            : {
                pond_id: pondId,
                fish_type_id: r.fish_type_id,
                grade_id: r.grade_id,
                size_cm: r.size_cm,
                actual_count: r.actual_count!,
              },
        );

      const result = await StockOpnamesApi.createBulk({
        opname_date: opnameDate,
        notes: notes || undefined,
        rows: payload,
      });
      return result.data.length;
    },
    onSuccess: (count) => {
      success({
        title: "Opname Disimpan",
        message: `${count} draf opname tersimpan (atomic). Klik Selesaikan tiap baris untuk menerapkan ke stok.`,
      });
      setOpen(false);
      setLocationId(0);
      setPondId(0);
      setNotes("");
      setRows([]);
      qc.invalidateQueries({ queryKey: ["stock-opnames"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menyimpan opname."));
    },
  });

  const complete = useMutation({
    mutationFn: StockOpnamesApi.complete,
    onSuccess: () => {
      success({
        title: "Opname Selesai",
        message: "Stok kolam sudah disesuaikan.",
      });
      qc.invalidateQueries({ queryKey: ["stock-opnames"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
      qc.invalidateQueries({ queryKey: ["pond-batches"] });
      // Selesai opname menulis ulang jumlah ikan: daftar stok & beranda ikut.
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal selesaikan opname."));
    },
  });

  const remove = useMutation({
    mutationFn: StockOpnamesApi.delete,
    onSuccess: () => {
      success({
        title: "Opname Dihapus",
        message: "Catatan opname dihapus.",
      });
      qc.invalidateQueries({ queryKey: ["stock-opnames"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menghapus opname."));
    },
  });

  function openCreate() {
    setLocationId(0);
    setPondId(0);
    setOpnameDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setRows([]);
    setOpen(true);
  }

  function handlePondChange(newPondId: number) {
    setPondId(newPondId);
    setRows([]);
  }

  function updateRow(idx: number, value: string) {
    const v = value === "" ? null : Number(value);
    setRows((rs) =>
      rs.map((r, i) => (i === idx ? { ...r, actual_count: v } : r)),
    );
  }

  function patchNewRow(idx: number, patch: Partial<NewRow>) {
    setRows((rs) =>
      rs.map((r, i) => (i === idx && r.kind === "new" ? { ...r, ...patch } : r)),
    );
  }

  function addNewRow() {
    setRows((rs) => [...rs, emptyNewRow()]);
  }

  function removeRow(idx: number) {
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }

  async function handleDelete(s: StockOpname) {
    const ok = await confirmDelete({
      title: `Hapus catatan opname?`,
      description:
        s.status === "completed"
          ? `Opname tanggal ${formatDate(s.opname_date)} sudah selesai — menghapus akan kembalikan stok kolam (${s.difference >= 0 ? "+" : ""}${s.difference} ekor).`
          : `Catatan opname draf tanggal ${formatDate(s.opname_date)} akan dihapus.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(s.id);
  }

  // Auto-init draft rows ketika pondBatches sukses load (proper effect, bukan setState saat render)
  useEffect(() => {
    if (pondBatches && pondBatches.length > 0) {
      setRows((prev) =>
        prev.length === 0
          ? pondBatches.map((b) => ({
              kind: "existing" as const,
              batch_id: b.id,
              current_count: b.current_count,
              actual_count: null,
            }))
          : prev,
      );
    }
  }, [pondBatches]);

  const columns: Column<StockOpname>[] = [
    {
      key: "opname_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="font-medium">{formatDate(row.opname_date)}</span>
      ),
    },
    {
      key: "kolam",
      header: "Kolam / Jenis",
      cell: (row) => {
        // Baris temuan fisik yang masih draf belum punya batch, jadi identitas
        // ikannya diambil dari opname itu sendiri.
        const pond = row.batch?.pond ?? row.pond;
        const fishType = row.batch?.fish_type ?? row.fish_type;
        const grade = row.batch?.grade ?? row.grade;
        const sizeCm = row.batch?.size_cm ?? row.size_cm;
        const isNewStock = !row.batch_id;

        return (
          <div className="text-[12px]">
            <div className="flex items-center gap-1.5 font-medium">
              {pond?.name ?? "—"}
              {isNewStock && (
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  ikan baru
                </span>
              )}
            </div>
            <div className="text-muted-foreground/70">
              {fishType?.full_name ?? fishType?.name ?? "—"}
              {grade?.name ? ` · ${grade.name}` : ""}
              {sizeCm ? ` · ${formatSize(sizeCm, row.batch?.size_max_cm ?? null)}` : ""}
            </div>
          </div>
        );
      },
    },
    {
      key: "system_count",
      header: "Sistem",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => formatNumber(row.system_count),
    },
    {
      key: "actual_count",
      header: "Fisik",
      headerClassName: "text-right",
      className: "text-right font-mono font-semibold",
      cell: (row) => formatNumber(row.actual_count),
    },
    {
      key: "difference",
      header: "Selisih",
      headerClassName: "text-right",
      className: "text-right font-mono font-semibold",
      cell: (row) => {
        if (row.difference === 0) {
          return (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Minus className="h-3 w-3" /> 0
            </span>
          );
        }
        if (row.difference > 0) {
          return (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" /> +{formatNumber(row.difference)}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <TrendingDown className="h-3 w-3" /> {formatNumber(row.difference)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          status={row.status}
          variant={STATUS_VARIANT[row.status] ?? "default"}
        />
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      headerClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => complete.mutate(row.id)}
              title="Terapkan ke stok kolam"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Selesaikan
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => handleDelete(row)}
            title="Hapus"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stok Opname"
        description="Hitung fisik vs stok sistem — koreksi otomatis per jenis ikan"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv.stockOpnames().catch(() =>
                  toast.error("Gagal download CSV."),
                )
              }
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Opname Baru
            </Button>
          </div>
        }
      />

      <DataTable
        data={opnames}
        columns={columns}
        keyExtractor={(s) => String(s.id)}
        isLoading={isLoading}
        emptyMessage="Belum ada catatan opname."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Stok Opname Baru</DialogTitle>
            <DialogDescription>
              Pilih lokasi & kolam, lalu input hitung fisik tiap baris jenis.
              Baris yang tidak diisi akan dilewati.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>
                  Lokasi <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(locationId || "")}
                  onValueChange={(v) => {
                    setLocationId(+v);
                    setPondId(0);
                    setRows([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLocations.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Kolam <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(pondId || "")}
                  onValueChange={(v) => handlePondChange(+v)}
                  disabled={!locationId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        locationId ? "Pilih kolam" : "Pilih lokasi dulu"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePonds.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} · {formatNumber(p.total)} ekor
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Tanggal <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={opnameDate}
                  onChange={(e) => setOpnameDate(e.target.value)}
                />
              </div>
            </div>

            {pondId > 0 && (pondBatches?.length ?? 0) === 0 && rows.length === 0 && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-[12px] text-muted-foreground">
                Kolam ini belum punya isi di sistem. Kalau di lapangan ada ikannya,
                tambahkan langsung dari sini — barisnya akan masuk ke kolam ini
                begitu opname diselesaikan.
              </div>
            )}

            {pondId > 0 && (
              <Button variant="secondary" size="sm" onClick={addNewRow}>
                <Plus className="h-4 w-4" />
                Tambah ikan yang belum tercatat
              </Button>
            )}

            {rows.length > 0 && (
              <>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Baris Ikan di Kolam
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {totals.filled} / {rows.length} terisi
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <div className="col-span-5">Jenis · Grade · Ukuran</div>
                      <div className="col-span-2 text-right">Sistem</div>
                      <div className="col-span-3 text-right">Fisik</div>
                      <div className="col-span-2 text-right">Selisih</div>
                    </div>
                    {rows.map((r, idx) => {
                      const isNew = r.kind === "new";
                      const b = isNew ? undefined : batchesById.get(r.batch_id);
                      const systemCount = isNew ? 0 : r.current_count;
                      const diff =
                        r.actual_count !== null
                          ? r.actual_count - systemCount
                          : null;
                      return (
                        <div
                          key={isNew ? r.key : `batch-${r.batch_id}`}
                          className={
                            "grid grid-cols-12 items-center gap-2 rounded border p-2 text-[12px] " +
                            (isNew
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-border/40 bg-background/50")
                          }
                        >
                          {isNew ? (
                            <div className="col-span-5 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <FishIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  Ikan baru
                                </span>
                              </div>
                              <Select
                                value={r.fish_type_id ? String(r.fish_type_id) : ""}
                                onValueChange={(v) =>
                                  patchNewRow(idx, { fish_type_id: +v })
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Jenis ikan (opsional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {fishTypes.map((f) => (
                                    <SelectItem key={f.id} value={String(f.id)}>
                                      {f.full_name ?? f.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={r.grade_id ? String(r.grade_id) : ""}
                                onValueChange={(v) => patchNewRow(idx, { grade_id: +v })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Grade (opsional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {grades.map((g) => (
                                    <SelectItem key={g.id} value={String(g.id)}>
                                      {g.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="col-span-5">
                              <div className="font-medium">
                                {b?.fish_type?.full_name ?? b?.fish_type?.name ?? "—"}
                              </div>
                              <div className="text-muted-foreground/70 text-[11px]">
                                {b?.grade?.name ?? "Belum disortir"}
                                {b?.size_cm
                                  ? ` · ${formatSize(b.size_cm, b.size_max_cm)}`
                                  : ""}
                              </div>
                            </div>
                          )}
                          <div className="col-span-2 text-right font-mono">
                            {isNew ? (
                              <span className="text-muted-foreground/50">baru</span>
                            ) : (
                              formatNumber(systemCount)
                            )}
                          </div>
                          <div className="col-span-3">
                            <Input
                              className="h-8 text-right font-mono"
                              type="number"
                              min={0}
                              placeholder="—"
                              value={r.actual_count ?? ""}
                              onChange={(e) => updateRow(idx, e.target.value)}
                            />
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-1 text-right font-mono font-semibold">
                            {diff === null ? (
                              <span className="text-muted-foreground/40">—</span>
                            ) : diff === 0 ? (
                              <span className="text-muted-foreground">0</span>
                            ) : diff > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                +{formatNumber(diff)}
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">
                                {formatNumber(diff)}
                              </span>
                            )}
                            {isNew && (
                              <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                title="Hapus baris ini"
                                className="text-muted-foreground transition-colors hover:text-rose-500"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <GlassCard variant="subtle" className="!py-3">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <Stat
                      label="Sistem"
                      value={`${formatNumber(totals.system)} ekor`}
                    />
                    <Stat
                      label="Total Fisik"
                      value={`${formatNumber(totals.actual)} ekor`}
                    />
                    <Stat
                      label="Selisih"
                      value={
                        totals.diff === 0
                          ? "0"
                          : totals.diff > 0
                          ? `+${formatNumber(totals.diff)}`
                          : `${formatNumber(totals.diff)}`
                      }
                      tone={
                        totals.diff === 0
                          ? "default"
                          : totals.diff > 0
                          ? "positive"
                          : "negative"
                      }
                    />
                  </div>
                </GlassCard>
              </>
            )}

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="mis. opname rutin akhir bulan"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                !pondId ||
                !opnameDate ||
                totals.filled === 0 ||
                // Baris ikan baru tanpa jumlah akan ditolak server; cegah di sini
                // supaya seluruh kiriman tidak gagal gara-gara satu baris kosong.
                rows.some((r) => r.kind === "new" && !r.actual_count) ||
                create.isPending
              }
              onClick={() => create.mutate()}
            >
              <ClipboardCheck className="h-4 w-4" />
              Simpan {totals.filled > 0 ? `${totals.filled} Draf` : "Draf"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          tone === "positive"
            ? "font-mono font-medium text-emerald-600 dark:text-emerald-400"
            : tone === "negative"
            ? "font-mono font-medium text-rose-600 dark:text-rose-400"
            : "font-mono font-medium text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}
