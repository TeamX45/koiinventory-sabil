import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, X } from "lucide-react";
import {
  PondsApi,
  LocationsApi,
  PondCategoriesApi,
  MasterApi,
} from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import {
  PageHeader,
  DataTable,
  PriceShortcutInput,
  type Column,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
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
import { GlassCard } from "@/components/common";
import { formatNumber } from "@/utils/format";
import type { Pond } from "@/types/models";

interface BatchRow {
  fish_type_id: number | null;
  grade_id: number | null;
  count: number;
  size_cm: number | null;
  size_max_cm: number | null;
  price_per_fish: number | null;
}

interface PondForm {
  name: string;
  location_id: number;
  pond_category_id: number;
  capacity: number | null;
  target_min_size_cm: number | null;
  target_max_size_cm: number | null;
  grow_duration_months: number | null;
  is_active: boolean;
  notes: string;
  batches: BatchRow[];
}

const emptyBatchRow = (): BatchRow => ({
  fish_type_id: null,
  grade_id: null,
  count: 0,
  size_cm: null,
  size_max_cm: null,
  price_per_fish: null,
});

const emptyForm: PondForm = {
  name: "",
  location_id: 0,
  pond_category_id: 0,
  capacity: null,
  target_min_size_cm: null,
  target_max_size_cm: null,
  grow_duration_months: null,
  is_active: true,
  notes: "",
  batches: [],
};

export default function PondsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });
  const { data: locationList } = useQuery({
    queryKey: ["locations"],
    queryFn: LocationsApi.list,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["pond-categories"],
    queryFn: PondCategoriesApi.list,
  });
  const { data: fishTypes = [] } = useQuery({
    queryKey: ["fish-types"],
    queryFn: MasterApi.fishTypes,
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: MasterApi.grades,
  });

  const [locFilter, setLocFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pond | null>(null);
  const [form, setForm] = useState<PondForm>(emptyForm);

  const locations = useMemo(
    () =>
      Array.from(
        new Set((data ?? []).map((p) => p.location?.name).filter(Boolean))
      ) as string[],
    [data]
  );
  const categoryNames = useMemo(
    () =>
      Array.from(
        new Set((data ?? []).map((p) => p.category?.name).filter(Boolean))
      ) as string[],
    [data]
  );

  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (p) =>
          (locFilter === "all" || p.location?.name === locFilter) &&
          (catFilter === "all" || p.category?.name === catFilter)
      ),
    [data, locFilter, catFilter]
  );

  const create = useMutation({
    mutationFn: PondsApi.create,
    onSuccess: () => {
      success({
        title: "Kolam Ditambahkan",
        message: "Kolam baru beserta stok awal berhasil disimpan.",
      });
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["ponds"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menambah kolam."));
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<Pond> }) =>
      PondsApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["ponds"] });
      const previous = qc.getQueryData<Pond[]>(["ponds"]);
      qc.setQueryData<Pond[]>(["ponds"], (old) =>
        (old ?? []).map((p) =>
          p.id === vars.id ? ({ ...p, ...vars.payload } as Pond) : p,
        ),
      );
      const name =
        vars.payload.name ??
        previous?.find((p) => p.id === vars.id)?.name ??
        "Kolam";
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      success({
        title: "Kolam Diperbarui",
        message: `${name} berhasil disimpan.`,
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["ponds"], ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui kolam."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ponds"] }),
  });

  const remove = useMutation({
    mutationFn: PondsApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["ponds"] });
      const previous = qc.getQueryData<Pond[]>(["ponds"]);
      qc.setQueryData<Pond[]>(["ponds"], (old) =>
        (old ?? []).filter((p) => p.id !== id),
      );
      success({
        title: "Kolam Dihapus",
        message: "Data kolam berhasil dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["ponds"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus kolam."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ponds"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Pond) {
    setEditing(p);
    setForm({
      name: p.name,
      location_id: p.location_id,
      pond_category_id: p.pond_category_id,
      capacity: p.capacity,
      target_min_size_cm: p.target_min_size_cm,
      target_max_size_cm: p.target_max_size_cm,
      grow_duration_months: p.grow_duration_months,
      is_active: p.is_active,
      notes: "",
      batches: [],
    });
    setOpen(true);
  }

  function submit() {
    if (editing) {
      const { batches: _b, location_id: _l, pond_category_id: _p, ...payload } = form;
      void _b; void _l; void _p;
      update.mutate({ id: editing.id, payload });
      return;
    }
    // Create: filter batch yang count > 0
    const validBatches = form.batches.filter((b) => b.count > 0);
    create.mutate({ ...form, batches: validBatches } as unknown as Partial<Pond>);
  }

  async function handleDelete(p: Pond) {
    if ((p.current_stock ?? 0) > 0) {
      toast.error(
        `${p.name} masih ada ${formatNumber(p.current_stock!)} ekor stok aktif. Pindahkan dulu.`,
      );
      return;
    }
    const ok = await confirmDelete({
      title: `Hapus ${p.name}?`,
      description: `Kolam ${p.name} akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(p.id);
  }

  function addBatchRow() {
    setForm((f) => ({ ...f, batches: [...f.batches, emptyBatchRow()] }));
  }

  function updateBatchRow(idx: number, patch: Partial<BatchRow>) {
    setForm((f) => ({
      ...f,
      batches: f.batches.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  }

  function removeBatchRow(idx: number) {
    setForm((f) => ({
      ...f,
      batches: f.batches.filter((_, i) => i !== idx),
    }));
  }

  const totalEkorPreview = form.batches.reduce((s, b) => s + (b.count || 0), 0);

  const columns: Column<Pond>[] = [
    {
      key: "name",
      header: "Nama",
      sortable: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "location",
      header: "Lokasi",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3 w-3" /> {row.location?.name ?? "-"}
        </span>
      ),
    },
    {
      key: "category",
      header: "Kategori",
      cell: (row) => {
        const variant = row.category?.is_breeding
          ? "secondary"
          : row.category?.is_grow_out
          ? "outline"
          : "default";
        return <Badge variant={variant}>{row.category?.name ?? "-"}</Badge>;
      },
    },
    {
      key: "current_stock",
      header: "Stok Aktif",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <span
          className={
            row.current_stock
              ? "font-mono font-semibold"
              : "font-mono text-muted-foreground/60"
          }
        >
          {formatNumber(row.current_stock ?? 0)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      headerClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => openEdit(row)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
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
        title="Kolam"
        description="Daftar unit kolam & aquarium di semua lokasi"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Kolam
          </Button>
        }
      />

      <GlassCard variant="subtle" className="!py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={locFilter} onValueChange={setLocFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Semua lokasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua lokasi</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="sm:w-64">
                <SelectValue placeholder="Semua kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categoryNames.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 text-[12px] text-muted-foreground">
            <span>{filtered.length} unit</span>
            <span className="text-muted-foreground/40">•</span>
            <span>
              {formatNumber(
                filtered.reduce((s, p) => s + (p.current_stock ?? 0), 0)
              )}{" "}
              ekor stok
            </span>
          </div>
        </div>
      </GlassCard>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(p) => String(p.id)}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Cari kolam..."
        onRowClick={(row) => navigate(`/ponds/${row.id}`)}
        emptyMessage="Tidak ada kolam yang cocok dengan filter."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.code}` : "Tambah Kolam"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Lokasi & kategori tidak bisa diubah setelah dibuat. Untuk koreksi stok, pakai menu Stok Opname."
                : "Buat kolam baru. Tambahkan baris ikan sesuai isi kolam saat ini (jenis, grade, ukuran, harga)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Nama <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Kolam 1 (Indukan)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Lokasi <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(form.location_id || "")}
                  disabled={!!editing}
                  onValueChange={(v) =>
                    setForm({ ...form, location_id: +v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationList?.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Kategori <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(form.pond_category_id || "")}
                  disabled={!!editing}
                  onValueChange={(v) =>
                    setForm({ ...form, pond_category_id: +v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editing && (
              <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Stok Awal — Baris Ikan
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    Total: <strong>{formatNumber(totalEkorPreview)}</strong> ekor
                  </span>
                </div>

                {form.batches.length === 0 && (
                  <p className="rounded border border-dashed border-border/60 p-3 text-center text-[12px] text-muted-foreground">
                    Belum ada baris. Klik "+ Tambah Baris Ikan" untuk input
                    isi kolam (mis. Kohaku · Grade A · 45 cm · 1.5 jt · 3 ekor).
                  </p>
                )}

                {form.batches.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 rounded border border-border/40 bg-background/50 p-2"
                  >
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Jenis
                      </Label>
                      <Select
                        value={String(row.fish_type_id ?? "")}
                        onValueChange={(v) =>
                          updateBatchRow(idx, { fish_type_id: v ? +v : null })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {fishTypes.map((f) => (
                            <SelectItem key={f.id} value={String(f.id)}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Grade
                      </Label>
                      <Select
                        value={String(row.grade_id ?? "")}
                        onValueChange={(v) =>
                          updateBatchRow(idx, { grade_id: v ? +v : null })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="—" />
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
                    <div className="col-span-1 space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Ekor
                      </Label>
                      <Input
                        className="h-8"
                        type="number"
                        min={1}
                        value={row.count || ""}
                        onChange={(e) =>
                          updateBatchRow(idx, {
                            count: e.target.value ? +e.target.value : 0,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        cm
                      </Label>
                      <Input
                        className="h-8"
                        type="number"
                        min={1}
                        max={200}
                        value={row.size_cm ?? ""}
                        onChange={(e) =>
                          updateBatchRow(idx, {
                            size_cm: e.target.value ? +e.target.value : null,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        s/d
                      </Label>
                      <Input
                        className="h-8"
                        type="number"
                        min={1}
                        max={200}
                        placeholder="—"
                        value={row.size_max_cm ?? ""}
                        onChange={(e) =>
                          updateBatchRow(idx, {
                            size_max_cm: e.target.value ? +e.target.value : null,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Harga / ekor
                      </Label>
                      <PriceShortcutInput
                        value={row.price_per_fish}
                        onChange={(v) =>
                          updateBatchRow(idx, { price_per_fish: v })
                        }
                        placeholder="1.5 jt"
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => removeBatchRow(idx)}
                        title="Hapus baris"
                      >
                        <X className="h-4 w-4 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={addBatchRow}
                  className="w-full"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Baris Ikan
                </Button>

                <p className="text-[11px] text-muted-foreground">
                  Stok awal opsional. Bisa kosong dulu, isi nanti via menu
                  Stok Opname / Pembelian / Panen.
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Min Ukuran Target (cm)</Label>
                <Input
                  type="number"
                  value={form.target_min_size_cm ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      target_min_size_cm: e.target.value
                        ? +e.target.value
                        : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Ukuran Target (cm)</Label>
                <Input
                  type="number"
                  value={form.target_max_size_cm ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      target_max_size_cm: e.target.value
                        ? +e.target.value
                        : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Durasi (bln)</Label>
                <Input
                  type="number"
                  value={form.grow_duration_months ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      grow_duration_months: e.target.value
                        ? +e.target.value
                        : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                !form.name ||
                !form.location_id ||
                !form.pond_category_id ||
                create.isPending ||
                update.isPending
              }
              onClick={submit}
            >
              {editing ? "Simpan Perubahan" : "Simpan Kolam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
