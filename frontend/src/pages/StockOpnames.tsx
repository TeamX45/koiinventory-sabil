import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { StockOpnamesApi, BatchesApi, LocationsApi } from "@/api/endpoints";
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
import { formatDate, formatNumber } from "@/utils/format";
import type { StockOpname, PaginatedResponse } from "@/types/models";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "warning",
  completed: "success",
  cancelled: "danger",
};

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

  const { data: batches } = useQuery({
    queryKey: ["batches", "active-all"],
    queryFn: () => BatchesApi.listAll({ status: "active" }),
  });
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: LocationsApi.list,
  });

  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState(0);
  const [pondId, setPondId] = useState(0);
  const emptyForm = {
    batch_id: 0,
    opname_date: new Date().toISOString().slice(0, 10),
    actual_count: 0,
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  // Hanya tampil lokasi yang punya batch aktif
  const availableLocations = useMemo(() => {
    if (!batches || !locations) return [];
    const ids = new Set(batches.map((b) => b.pond?.location_id).filter(Boolean));
    return locations.filter((l) => ids.has(l.id));
  }, [batches, locations]);

  // Kolam dalam lokasi terpilih yang punya batch aktif
  const availablePonds = useMemo(() => {
    if (!batches || !locationId) return [];
    const map = new Map<number, { id: number; name: string; total: number; batchCount: number }>();
    batches.forEach((b) => {
      if (b.pond?.location_id !== locationId) return;
      const existing = map.get(b.pond_id);
      if (existing) {
        existing.total += b.current_count;
        existing.batchCount += 1;
      } else {
        map.set(b.pond_id, {
          id: b.pond_id,
          name: b.pond?.name ?? "—",
          total: b.current_count,
          batchCount: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [batches, locationId]);

  // Batch dalam kolam terpilih
  const pondBatches = useMemo(() => {
    if (!batches || !pondId) return [];
    return batches.filter((b) => b.pond_id === pondId);
  }, [batches, pondId]);

  const [editing, setEditing] = useState<StockOpname | null>(null);
  const [editForm, setEditForm] = useState({
    opname_date: "",
    actual_count: 0,
    notes: "",
  });

  const selectedBatch = batches?.find((b) => b.id === form.batch_id);
  const previewDiff = selectedBatch
    ? form.actual_count - selectedBatch.current_count
    : 0;

  const create = useMutation({
    mutationFn: StockOpnamesApi.create,
    onMutate: (payload) => {
      if (page === 1) {
        const tempId = -Date.now();
        const batch = batches?.find((b) => b.id === payload.batch_id);
        const systemCount = batch?.current_count ?? 0;
        const optimistic = {
          id: tempId,
          code: "...",
          status: "draft",
          system_count: systemCount,
          difference: payload.actual_count - systemCount,
          batch,
          ...payload,
        } as unknown as StockOpname;
        qc.setQueryData<PaginatedResponse<StockOpname>>(
          ["stock-opnames", { page: 1 }],
          (old) =>
            old
              ? { ...old, data: [optimistic, ...old.data], meta: { ...old.meta, total: old.meta.total + 1 } }
              : old,
        );
      } else {
        setPage(1);
      }
      success({
        title: "Opname Disimpan",
        message: `Draf opname tersimpan. Klik Selesaikan untuk terapkan ke stok batch.`,
      });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menyimpan opname."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["stock-opnames"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: typeof editForm }) =>
      StockOpnamesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      const key = ["stock-opnames", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<StockOpname>>(key);
      qc.setQueryData<PaginatedResponse<StockOpname>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((s) => {
                if (s.id !== vars.id) return s;
                const newDiff =
                  vars.payload.actual_count !== undefined
                    ? vars.payload.actual_count - s.system_count
                    : s.difference;
                return { ...s, ...vars.payload, difference: newDiff } as StockOpname;
              }),
            }
          : old,
      );
      success({
        title: "Opname Diperbarui",
        message: "Perubahan opname berhasil disimpan.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui opname."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["stock-opnames"] }),
  });

  const complete = useMutation({
    mutationFn: StockOpnamesApi.complete,
    onMutate: async (id) => {
      const key = ["stock-opnames", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<StockOpname>>(key);
      qc.setQueryData<PaginatedResponse<StockOpname>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((s) =>
                s.id === id ? ({ ...s, status: "completed" } as StockOpname) : s,
              ),
            }
          : old,
      );
      success({
        title: "Opname Selesai",
        message: "Stok batch sudah di-update sesuai hitung fisik.",
      });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal selesaikan opname."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["stock-opnames"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const remove = useMutation({
    mutationFn: StockOpnamesApi.delete,
    onMutate: async (id) => {
      const key = ["stock-opnames", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<StockOpname>>(key);
      qc.setQueryData<PaginatedResponse<StockOpname>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((s) => s.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      success({
        title: "Opname Dihapus",
        message: "Catatan opname berhasil dihapus.",
      });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus opname."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["stock-opnames"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  function openCreate() {
    setLocationId(0);
    setPondId(0);
    setForm(emptyForm);
    setOpen(true);
  }

  // Saat user pilih kolam: kalau cuma 1 batch di kolam itu, auto-select
  function handlePondChange(newPondId: number) {
    setPondId(newPondId);
    const inPond = (batches ?? []).filter((b) => b.pond_id === newPondId);
    if (inPond.length === 1) {
      setForm({ ...form, batch_id: inPond[0].id });
    } else {
      setForm({ ...form, batch_id: 0 });
    }
  }

  function openEdit(s: StockOpname) {
    setEditing(s);
    setEditForm({
      opname_date: s.opname_date.slice(0, 10),
      actual_count: s.actual_count,
      notes: s.notes ?? "",
    });
  }

  async function handleDelete(s: StockOpname) {
    const ok = await confirmDelete({
      title: `Hapus catatan opname?`,
      description:
        s.status === "completed"
          ? `Opname tanggal ${formatDate(s.opname_date)} sudah selesai — menghapus akan kembalikan stok batch (${s.difference >= 0 ? "+" : ""}${s.difference} ekor).`
          : `Catatan opname draf tanggal ${formatDate(s.opname_date)} akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(s.id);
  }

  function submitCreate() {
    const payload = form;
    setOpen(false);
    setForm(emptyForm);
    create.mutate(payload);
  }

  function submitEdit() {
    if (!editing) return;
    const id = editing.id;
    const payload = editForm;
    setEditing(null);
    update.mutate({ id, payload });
  }

  const columns: Column<StockOpname>[] = [
    {
      key: "opname_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="font-medium">{formatDate(row.opname_date)}</span>
      ),
    },
    {
      key: "batch",
      header: "Kolam / Grade",
      cell: (row) => (
        <div className="text-[12px]">
          <div className="font-medium">{row.batch?.pond?.name ?? "—"}</div>
          <div className="text-muted-foreground/70">
            {row.batch?.grade?.name ?? "Belum disortir"}
          </div>
        </div>
      ),
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
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => complete.mutate(row.id)}
                title="Apply ke stok batch"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Selesaikan
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => openEdit(row)}
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
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
        description="Hitung fisik vs stok sistem — koreksi otomatis ke batch ikan"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Opname Baru
          </Button>
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

      {/* Create modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Stok Opname Baru</DialogTitle>
            <DialogDescription>
              Pilih lokasi & kolam, lalu input hitung fisik. Selisih akan dikoreksi
              otomatis saat diselesaikan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {availableLocations.length === 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-700 dark:text-amber-400">
                Belum ada batch ikan aktif. Buat <strong>Pembelian → Terima</strong> atau{" "}
                <strong>Panen → Terima</strong> dulu supaya ada batch yang bisa di-opname.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Lokasi <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(locationId || "")}
                  onValueChange={(v) => {
                    setLocationId(+v);
                    setPondId(0);
                    setForm({ ...form, batch_id: 0 });
                  }}
                  disabled={availableLocations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      availableLocations.length === 0
                        ? "Belum ada batch"
                        : "Pilih lokasi"
                    } />
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
                    <SelectValue placeholder={locationId ? "Pilih kolam" : "Pilih lokasi dulu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePonds.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} · {formatNumber(p.total)} ekor
                        {p.batchCount > 1 ? ` (${p.batchCount} batch)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pondId > 0 && pondBatches.length > 1 && (
              <div className="space-y-2">
                <Label>
                  Pilih Batch <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(form.batch_id || "")}
                  onValueChange={(v) => setForm({ ...form, batch_id: +v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kolam ini punya beberapa batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {pondBatches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.grade?.name ?? "Belum disortir"} · {formatNumber(b.current_count)} ekor
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Kolam ini berisi beberapa batch (grade berbeda) — pilih satu yang mau di-opname.
                </p>
              </div>
            )}

            {selectedBatch && (
              <GlassCard variant="subtle" className="!py-3">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Stat
                    label="Stok Sistem"
                    value={`${formatNumber(selectedBatch.current_count)} ekor`}
                  />
                  <Stat
                    label="Hitung Fisik"
                    value={`${formatNumber(form.actual_count)} ekor`}
                  />
                  <Stat
                    label="Selisih"
                    value={
                      previewDiff === 0
                        ? "0"
                        : previewDiff > 0
                        ? `+${formatNumber(previewDiff)}`
                        : `${formatNumber(previewDiff)}`
                    }
                    tone={
                      previewDiff === 0
                        ? "default"
                        : previewDiff > 0
                        ? "positive"
                        : "negative"
                    }
                  />
                </div>
              </GlassCard>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Tanggal <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.opname_date}
                  onChange={(e) =>
                    setForm({ ...form, opname_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Hitung Fisik (ekor) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.actual_count || ""}
                  onChange={(e) =>
                    setForm({ ...form, actual_count: +e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="mis. selisih karena migrasi otomatis, sampling, dst."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={!form.batch_id || !form.opname_date}
              onClick={submitCreate}
            >
              <ClipboardCheck className="h-4 w-4" />
              Simpan Draf
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Stok Opname</DialogTitle>
            <DialogDescription>
              Ubah tanggal, hasil hitung, atau catatan. Hanya draft yang bisa diubah.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={editForm.opname_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, opname_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Hitung Fisik (ekor)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.actual_count || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, actual_count: +e.target.value })
                  }
                />
              </div>
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
            <Button onClick={submitEdit}>Simpan Perubahan</Button>
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
