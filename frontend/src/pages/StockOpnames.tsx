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
import { StockOpnamesApi, LocationsApi, PondsApi } from "@/api/endpoints";
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

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: LocationsApi.list,
  });
  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });

  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState(0);
  const [pondId, setPondId] = useState(0);
  const emptyForm = {
    pond_id: 0,
    opname_date: new Date().toISOString().slice(0, 10),
    actual_count: 0,
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

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

  const selectedPond = ponds?.find((p) => p.id === pondId);
  const pondCurrentStockFromPond = selectedPond?.current_stock ?? 0;

  const [editing, setEditing] = useState<StockOpname | null>(null);
  const [editForm, setEditForm] = useState({
    opname_date: "",
    actual_count: 0,
    notes: "",
  });

  const previewDiff = pondId > 0
    ? form.actual_count - pondCurrentStockFromPond
    : 0;

  const create = useMutation({
    mutationFn: StockOpnamesApi.create,
    onMutate: (payload) => {
      if (page === 1) {
        const tempId = -Date.now();
        const pond = ponds?.find((p) => p.id === payload.pond_id);
        const systemCount = pond?.current_stock ?? 0;
        const optimistic = {
          id: tempId,
          code: "...",
          status: "draft",
          system_count: systemCount,
          actual_count: payload.actual_count,
          difference: payload.actual_count - systemCount,
          opname_date: payload.opname_date,
          notes: payload.notes,
          batch: pond ? { pond } : undefined,
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
        message: `Draf opname tersimpan. Klik Selesaikan untuk terapkan ke stok kolam.`,
      });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menyimpan opname."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["stock-opnames"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
    },
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
        message: "Stok kolam sudah disesuaikan dengan hitung fisik.",
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
      qc.invalidateQueries({ queryKey: ["ponds"] });
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
      qc.invalidateQueries({ queryKey: ["ponds"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  function openCreate() {
    setLocationId(0);
    setPondId(0);
    setForm(emptyForm);
    setOpen(true);
  }

  function handlePondChange(newPondId: number) {
    setPondId(newPondId);
    setForm({ ...form, pond_id: newPondId });
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
          ? `Opname tanggal ${formatDate(s.opname_date)} sudah selesai — menghapus akan kembalikan stok kolam (${s.difference >= 0 ? "+" : ""}${s.difference} ekor).`
          : `Catatan opname draf tanggal ${formatDate(s.opname_date)} akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(s.id);
  }

  function submitCreate() {
    const payload = {
      pond_id: form.pond_id,
      opname_date: form.opname_date,
      actual_count: form.actual_count,
      notes: form.notes,
    };
    setOpen(false);
    setLocationId(0);
    setPondId(0);
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
                title="Terapkan ke stok kolam"
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
        description="Hitung fisik vs stok sistem — koreksi stok kolam otomatis"
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
                Belum ada lokasi. Buat <strong>Lokasi</strong> dulu di menu Data Master.
              </div>
            )}
            {locationId > 0 && availablePonds.length === 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-700 dark:text-amber-400">
                Lokasi ini belum punya kolam aktif. Buat <strong>Kolam</strong> dulu di
                menu Inventaris.
              </div>
            )}
            {pondId > 0 && pondCurrentStockFromPond === 0 && (
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-[12px] text-cyan-700 dark:text-cyan-400">
                Stok kolam saat ini <strong>0 ekor</strong>. Hasil hitung fisik akan
                jadi stok awal kolam.
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
                    setForm({ ...form, pond_id: 0 });
                  }}
                  disabled={availableLocations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      availableLocations.length === 0
                        ? "Belum ada lokasi"
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
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pondId > 0 && (
              <GlassCard variant="subtle" className="!py-3">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Stat
                    label="Stok Sistem"
                    value={`${formatNumber(pondCurrentStockFromPond)} ekor`}
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
              disabled={!pondId || !form.opname_date}
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
