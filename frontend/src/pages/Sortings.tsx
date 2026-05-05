import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, CheckCircle2, Trash2, Pencil } from "lucide-react";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import {
  SortingsApi,
  BatchesApi,
  MasterApi,
  PondsApi,
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
import { formatDate, formatNumber, formatRp } from "@/utils/format";
import type { Sorting, PaginatedResponse } from "@/types/models";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "warning",
  completed: "success",
  cancelled: "danger",
};

interface ResultRow {
  grade_id: number;
  target_pond_id: number;
  count: number;
  price_per_fish: number;
}

export default function SortingsPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["sortings", { page }],
    queryFn: () => SortingsApi.list({ page }),
    placeholderData: (prev) => prev,
  });
  const sortings = data?.data ?? [];
  const meta = data?.meta;
  const { data: batches } = useQuery({
    queryKey: ["batches", "unsorted-all"],
    queryFn: () => BatchesApi.listAll({ unsorted: 1 }),
  });
  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: MasterApi.grades,
  });
  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });

  const [open, setOpen] = useState(false);
  const [sourceBatchId, setSourceBatchId] = useState(0);
  const [sortingDate, setSortingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [totalLoss, setTotalLoss] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([
    { grade_id: 0, target_pond_id: 0, count: 0, price_per_fish: 0 },
  ]);

  const [editing, setEditing] = useState<Sorting | null>(null);
  const [editForm, setEditForm] = useState({
    sorting_date: "",
    total_loss: 0,
    notes: "",
  });

  const sourceBatch = batches?.find((b) => b.id === sourceBatchId);
  const totalDistributed = results.reduce(
    (s, r) => s + (r.count || 0),
    0
  );
  const remainingFromSource = sourceBatch
    ? sourceBatch.current_count - totalDistributed - totalLoss
    : 0;

  const create = useMutation({
    mutationFn: SortingsApi.create,
    onMutate: (payload) => {
      if (page === 1) {
        const tempId = -Date.now();
        const totalSorted = payload.results.reduce((s, r) => s + (r.count || 0), 0);
        const optimistic = {
          id: tempId,
          code: "...",
          status: "draft",
          source_batch_id: payload.source_batch_id,
          sorting_date: payload.sorting_date,
          total_sorted: totalSorted,
          total_loss: payload.total_loss ?? 0,
        } as unknown as Sorting;
        qc.setQueryData<PaginatedResponse<Sorting>>(
          ["sortings", { page: 1 }],
          (old) =>
            old
              ? { ...old, data: [optimistic, ...old.data], meta: { ...old.meta, total: old.meta.total + 1 } }
              : old,
        );
      } else {
        setPage(1);
      }
      success({
        title: "Sortir Disimpan",
        message: `Sortir tersimpan sebagai draf. Klik Selesaikan untuk eksekusi distribusi.`,
      });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menyimpan sortir."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sortings"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  const complete = useMutation({
    mutationFn: SortingsApi.complete,
    onMutate: async (id) => {
      const key = ["sortings", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Sorting>>(key);
      qc.setQueryData<PaginatedResponse<Sorting>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((s) =>
                s.id === id ? ({ ...s, status: "completed" } as Sorting) : s,
              ),
            }
          : old,
      );
      success({
        title: "Sortir Selesai",
        message: "Batch baru dibuat dan stok sumber diperbarui.",
      });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal selesaikan sortir."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sortings"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: typeof editForm }) =>
      SortingsApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      const key = ["sortings", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Sorting>>(key);
      qc.setQueryData<PaginatedResponse<Sorting>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((s) =>
                s.id === vars.id ? ({ ...s, ...vars.payload } as Sorting) : s,
              ),
            }
          : old,
      );
      success({
        title: "Sortir Diperbarui",
        message: "Perubahan sortir berhasil disimpan.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui sortir."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["sortings"] }),
  });

  const remove = useMutation({
    mutationFn: SortingsApi.delete,
    onMutate: async (id) => {
      const key = ["sortings", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Sorting>>(key);
      qc.setQueryData<PaginatedResponse<Sorting>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((s) => s.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      success({ title: "Sortir Dihapus", message: "Catatan sortir berhasil dihapus." });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus sortir."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sortings"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  function openEdit(s: Sorting) {
    setEditing(s);
    setEditForm({
      sorting_date: s.sorting_date.slice(0, 10),
      total_loss: s.total_loss,
      notes: "",
    });
  }

  async function handleDelete(s: Sorting) {
    const ok = await confirmDelete({
      title: `Hapus catatan sortir?`,
      description: `Sortir tanggal ${formatDate(s.sorting_date)} akan dihapus permanen. Stok batch sumber akan dikembalikan.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(s.id);
  }

  function reset() {
    setSourceBatchId(0);
    setTotalLoss(0);
    setResults([{ grade_id: 0, target_pond_id: 0, count: 0, price_per_fish: 0 }]);
  }

  function updateRow(idx: number, patch: Partial<ResultRow>) {
    setResults((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  }

  const columns: Column<Sorting>[] = [
    {
      key: "sorting_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="font-medium">{formatDate(row.sorting_date)}</span>
      ),
    },
    {
      key: "source_batch_id",
      header: "Batch Sumber",
      cell: (row) => (
        <span className="text-[12px]">
          {row.source_batch?.pond?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "total_sorted",
      header: "Disortir",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => formatNumber(row.total_sorted),
    },
    {
      key: "total_loss",
      header: "Kehilangan",
      headerClassName: "text-right",
      className: "text-right font-mono text-rose-600 dark:text-rose-400",
      cell: (row) => formatNumber(row.total_loss),
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
      cell: (row) =>
        row.status === "draft" ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => complete.mutate(row.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Selesaikan
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => openEdit(row)} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(row)} title="Hapus">
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sortir Ikan"
        description="Pecah batch borong jadi grade & distribusi ke kolam target"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Sortir Baru
          </Button>
        }
      />

      <DataTable
        data={sortings}
        columns={columns}
        keyExtractor={(s) => String(s.id)}
        isLoading={isLoading}
        emptyMessage="Belum ada sortir."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sortir Baru</DialogTitle>
            <DialogDescription>
              Distribusi batch borong ke beberapa grade & kolam
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>
                  Batch Sumber <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(sourceBatchId || "")}
                  onValueChange={(v) => setSourceBatchId(+v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches?.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.pond?.name ?? "Batch"} · {formatNumber(b.current_count)} ekor
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
                  value={sortingDate}
                  onChange={(e) => setSortingDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Kehilangan (mati saat sortir)</Label>
                <Input
                  type="number"
                  min={0}
                  value={totalLoss}
                  onChange={(e) => setTotalLoss(+e.target.value)}
                />
              </div>
            </div>

            {sourceBatch && (
              <GlassCard variant="subtle" className="!py-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <Stat
                    label="Stok Sumber"
                    value={`${formatNumber(sourceBatch.current_count)} ekor`}
                  />
                  <Stat
                    label="Didistribusi"
                    value={`${formatNumber(totalDistributed)} ekor`}
                  />
                  <Stat
                    label="Kehilangan"
                    value={`${formatNumber(totalLoss)} ekor`}
                  />
                  <Stat
                    label="Sisa"
                    value={`${formatNumber(remainingFromSource)} ekor`}
                    warning={remainingFromSource < 0}
                  />
                </div>
              </GlassCard>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Distribusi Hasil</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setResults([
                      ...results,
                      {
                        grade_id: 0,
                        target_pond_id: 0,
                        count: 0,
                        price_per_fish: 0,
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Baris
                </Button>
              </div>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <GlassCard variant="subtle" key={i} className="!py-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider">
                          Grade
                        </Label>
                        <Select
                          value={String(r.grade_id || "")}
                          onValueChange={(v) =>
                            updateRow(i, { grade_id: +v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih" />
                          </SelectTrigger>
                          <SelectContent>
                            {grades?.map((g) => (
                              <SelectItem key={g.id} value={String(g.id)}>
                                {g.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-12 sm:col-span-4 space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider">
                          Kolam Tujuan
                        </Label>
                        <Select
                          value={String(r.target_pond_id || "")}
                          onValueChange={(v) =>
                            updateRow(i, { target_pond_id: +v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih" />
                          </SelectTrigger>
                          <SelectContent>
                            {ponds?.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-5 sm:col-span-2 space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider">
                          Ekor
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={r.count || ""}
                          onChange={(e) =>
                            updateRow(i, { count: +e.target.value })
                          }
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2 space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider">
                          Rp / ekor
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={r.price_per_fish || ""}
                          onChange={(e) =>
                            updateRow(i, { price_per_fish: +e.target.value })
                          }
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() =>
                            setResults(results.filter((_, idx) => idx !== i))
                          }
                          disabled={results.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </div>
                    </div>
                    {r.count > 0 && r.price_per_fish > 0 && (
                      <div className="mt-2 text-[11px] text-right text-muted-foreground">
                        Subtotal:{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {formatRp(r.count * r.price_per_fish)}
                        </span>
                      </div>
                    )}
                  </GlassCard>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                !sourceBatchId ||
                results.some(
                  (r) =>
                    !r.grade_id ||
                    !r.target_pond_id ||
                    !r.count ||
                    r.price_per_fish < 0
                ) ||
                remainingFromSource < 0
              }
              onClick={() => {
                const payload = {
                  source_batch_id: sourceBatchId,
                  sorting_date: sortingDate,
                  total_loss: totalLoss,
                  results,
                };
                setOpen(false);
                reset();
                create.mutate(payload);
              }}
            >
              Simpan Draf
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sortir</DialogTitle>
            <DialogDescription>
              Ubah tanggal, kehilangan, atau catatan sortir draf
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Tanggal Sortir <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="date"
                value={editForm.sorting_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, sorting_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Loss (mati saat sortir)</Label>
              <Input
                type="number"
                min={0}
                value={editForm.total_loss}
                onChange={(e) =>
                  setEditForm({ ...editForm, total_loss: +e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              disabled={!editForm.sorting_date}
              onClick={() => {
                if (!editing) return;
                const id = editing.id;
                const payload = editForm;
                setEditing(null);
                update.mutate({ id, payload });
              }}
            >
              Simpan Perubahan
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
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          warning
            ? "font-mono font-medium text-rose-600 dark:text-rose-400"
            : "font-mono font-medium text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}
