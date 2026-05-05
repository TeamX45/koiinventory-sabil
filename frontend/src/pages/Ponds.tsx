import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { PondsApi, LocationsApi, PondCategoriesApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { PageHeader, DataTable, type Column } from "@/components/common";
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
}

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
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["ponds"] });
      const previous = qc.getQueryData<Pond[]>(["ponds"]);
      const tempId = -Date.now();
      const location = locationList?.find((l) => l.id === payload.location_id);
      const category = categories.find((c) => c.id === payload.pond_category_id);
      const optimistic = {
        id: tempId,
        current_stock: 0,
        location,
        category,
        ...payload,
      } as unknown as Pond;
      qc.setQueryData<Pond[]>(["ponds"], (old) => [optimistic, ...(old ?? [])]);
      setOpen(false);
      setForm(emptyForm);
      success({
        title: "Kolam Ditambahkan",
        message: `${payload.name} berhasil disimpan.`,
      });
      return { previous, tempId };
    },
    onSuccess: (data, _vars, ctx) => {
      qc.setQueryData<Pond[]>(["ponds"], (old) =>
        (old ?? []).map((p) => (p.id === ctx?.tempId ? data : p)),
      );
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["ponds"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menambah kolam."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ponds"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<Pond> }) =>
      PondsApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["ponds"] });
      const previous = qc.getQueryData<Pond[]>(["ponds"]);
      qc.setQueryData<Pond[]>(["ponds"], (old) =>
        (old ?? []).map((p) =>
          p.id === vars.id ? { ...p, ...vars.payload } as Pond : p,
        ),
      );
      const name = vars.payload.name ?? previous?.find((p) => p.id === vars.id)?.name ?? "Kolam";
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
    });
    setOpen(true);
  }

  function submit() {
    const isEditing = editing;
    const data = form;
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (isEditing) {
      // Backend update tidak menerima location_id, pond_category_id (immutable)
      const { location_id: _l, pond_category_id: _p, ...payload } = data;
      void _l; void _p;
      update.mutate({ id: isEditing.id, payload });
    } else {
      create.mutate(data);
    }
  }

  async function handleDelete(p: Pond) {
    if ((p.current_stock ?? 0) > 0) {
      toast.error(`${p.name} masih ada ${formatNumber(p.current_stock!)} ekor stok aktif. Pindahkan dulu.`);
      return;
    }
    const ok = await confirmDelete({
      title: `Hapus ${p.name}?`,
      description: `Kolam ${p.name} akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(p.id);
  }

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
      key: "size",
      header: "Ukuran Target",
      cell: (row) =>
        row.target_min_size_cm && row.target_max_size_cm ? (
          <span className="text-[12px] text-muted-foreground">
            {row.target_min_size_cm}–{row.target_max_size_cm} cm
            {row.grow_duration_months && (
              <span className="ml-2 text-muted-foreground/60">
                ~{row.grow_duration_months} bln
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        ),
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
        description="Daftar 24 unit kolam & aquarium di 3 lokasi"
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.code}` : "Tambah Kolam"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Kode, lokasi, dan kategori tidak bisa diubah setelah dibuat"
                : "Buat unit kolam atau aquarium baru"}
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
                placeholder="Kolam Tanah 1"
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

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Min Ukuran (cm)</Label>
                <Input
                  type="number"
                  value={form.target_min_size_cm ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      target_min_size_cm: e.target.value ? +e.target.value : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Ukuran (cm)</Label>
                <Input
                  type="number"
                  value={form.target_max_size_cm ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      target_max_size_cm: e.target.value ? +e.target.value : null,
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
                      grow_duration_months: e.target.value ? +e.target.value : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kapasitas (ekor)</Label>
              <Input
                type="number"
                value={form.capacity ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    capacity: e.target.value ? +e.target.value : null,
                  })
                }
              />
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
                !form.pond_category_id
              }
              onClick={submit}
            >
              {editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
