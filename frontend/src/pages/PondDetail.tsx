import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Ruler, Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { BatchesApi, MasterApi, PondsApi } from "@/api/endpoints";
import {
  PageHeader,
  GlassCard,
  DataTable,
  PriceShortcutInput,
  type Column,
} from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import {
  formatDate,
  formatNumber,
  formatRp,
  formatRpShort,
  formatSize,
} from "@/utils/format";
import type { Batch } from "@/types/models";

interface BatchForm {
  fish_type_id: number | null;
  grade_id: number | null;
  count: number;
  size_cm: number | null;
  size_max_cm: number | null;
  price_per_fish: number | null;
  notes: string;
}

const emptyBatchForm: BatchForm = {
  fish_type_id: null,
  grade_id: null,
  count: 0,
  size_cm: null,
  size_max_cm: null,
  price_per_fish: null,
  notes: "",
};

export default function PondDetailPage() {
  const { id } = useParams();
  const pondId = Number(id);
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const { data: pond, isLoading } = useQuery({
    queryKey: ["pond", pondId],
    queryFn: () => PondsApi.get(pondId),
  });
  const { data: batches, isLoading: bLoading } = useQuery({
    queryKey: ["pond-batches", pondId],
    queryFn: () => PondsApi.batches(pondId),
  });
  const { data: fishTypes = [] } = useQuery({
    queryKey: ["fish-types"],
    queryFn: MasterApi.fishTypes,
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: MasterApi.grades,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState<BatchForm>(emptyBatchForm);

  const create = useMutation({
    mutationFn: BatchesApi.create,
    onSuccess: () => {
      success({
        title: "Baris Ikan Ditambah",
        message: "Baris ikan baru tersimpan di kolam ini.",
      });
      setOpen(false);
      setForm(emptyBatchForm);
      qc.invalidateQueries({ queryKey: ["pond-batches", pondId] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menambah baris ikan."));
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<BatchForm> }) =>
      BatchesApi.update(vars.id, vars.payload),
    onSuccess: () => {
      success({
        title: "Baris Diperbarui",
        message: "Perubahan tersimpan.",
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyBatchForm);
      qc.invalidateQueries({ queryKey: ["pond-batches", pondId] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal memperbarui baris."));
    },
  });

  const remove = useMutation({
    mutationFn: BatchesApi.delete,
    onSuccess: () => {
      success({
        title: "Baris Dihapus",
        message: "Baris ikan dihapus dari kolam.",
      });
      qc.invalidateQueries({ queryKey: ["pond-batches", pondId] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menghapus baris."));
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyBatchForm);
    setOpen(true);
  }

  function openEdit(b: Batch) {
    setEditing(b);
    setForm({
      fish_type_id: b.fish_type_id,
      grade_id: b.grade_id,
      count: b.current_count,
      size_cm: b.size_cm,
      size_max_cm: b.size_max_cm,
      price_per_fish: b.price_per_fish ? Number(b.price_per_fish) : null,
      notes: b.notes ?? "",
    });
    setOpen(true);
  }

  function submit() {
    if (editing) {
      const { count: _c, ...payload } = form;
      void _c;
      update.mutate({ id: editing.id, payload });
    } else {
      if (form.count <= 0) {
        toast.error("Jumlah ekor harus lebih dari 0.");
        return;
      }
      create.mutate({ pond_id: pondId, ...form });
    }
  }

  async function handleDelete(b: Batch) {
    if (!["manual", "opname"].includes(b.source_type)) {
      toast.error(
        `Baris ini berasal dari ${b.source_type} — hapus via menu sumbernya.`,
      );
      return;
    }
    const ok = await confirmDelete({
      title: `Hapus baris ikan?`,
      description: `Baris ${b.current_count} ekor akan dihapus permanen dari kolam ini.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(b.id);
  }

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

  const totalStock = batches?.reduce((s, b) => s + b.current_count, 0) ?? 0;
  const valuation =
    batches?.reduce(
      (s, b) => s + b.current_count * Number(b.price_per_fish ?? 0),
      0,
    ) ?? 0;

  const columns: Column<Batch>[] = [
    {
      key: "fish_type",
      header: "Jenis",
      cell: (row) => (
        <span className="font-medium">
          {row.fish_type?.name ?? <span className="text-muted-foreground/60">—</span>}
        </span>
      ),
    },
    {
      key: "grade",
      header: "Grade",
      cell: (row) =>
        row.grade ? (
          <Badge
            variant="outline"
            className="border-emerald-200 text-emerald-700 dark:text-emerald-400"
          >
            {row.grade.name}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-amber-200 text-amber-700 dark:text-amber-400"
          >
            Belum disortir
          </Badge>
        ),
    },
    {
      key: "size",
      header: "Ukuran",
      cell: (row) => (
        <span className="text-[12px]">
          {formatSize(row.size_cm, row.size_max_cm)}
        </span>
      ),
    },
    {
      key: "current_count",
      header: "Ekor",
      headerClassName: "text-right",
      className: "text-right font-mono font-semibold",
      cell: (row) => formatNumber(row.current_count),
    },
    {
      key: "price_per_fish",
      header: "Harga/ekor",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => (
        <span title={formatRp(row.price_per_fish)}>
          {row.price_per_fish ? formatRpShort(row.price_per_fish) : "—"}
        </span>
      ),
    },
    {
      key: "entry_date",
      header: "Tanggal Masuk",
      cell: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDate(row.entry_date)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      headerClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => openEdit(row)}
            title="Edit baris"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {["manual", "opname"].includes(row.source_type) && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => handleDelete(row)}
              title="Hapus baris"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            </Button>
          )}
        </div>
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
        description={`${pond.location?.name ?? ""}${
          pond.category?.name ? " · " + pond.category.name : ""
        }`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Baris Ikan
          </Button>
        }
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
          <h2 className="font-semibold text-foreground">Total Ikan</h2>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {formatNumber(totalStock)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ekor di {batches?.length ?? 0} baris jenis
          </div>
        </GlassCard>

        <GlassCard gradient="amber">
          <h2 className="font-semibold text-foreground">Estimasi Nilai</h2>
          <div className="mt-2 text-2xl font-bold text-gradient-amber">
            {formatRp(valuation)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Total ekor × harga per ekor
          </div>
        </GlassCard>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">
          Isi Kolam (per Jenis)
        </h3>
        <DataTable
          data={batches ?? []}
          columns={columns}
          keyExtractor={(b) => String(b.id)}
          isLoading={bLoading}
          emptyMessage="Belum ada ikan di kolam ini. Klik 'Tambah Baris Ikan' untuk input."
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Baris Ikan" : "Tambah Baris Ikan"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah jenis, grade, ukuran, harga, atau catatan. Untuk ubah jumlah ekor pakai Stok Opname."
                : "Tambah baris isi kolam — mis. 3 ekor Kohaku Grade A, 45 cm, 1.5 jt/ekor."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jenis Ikan</Label>
                <Select
                  value={String(form.fish_type_id ?? "")}
                  onValueChange={(v) =>
                    setForm({ ...form, fish_type_id: v ? +v : null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis" />
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
              <div className="space-y-2">
                <Label>Grade</Label>
                <Select
                  value={String(form.grade_id ?? "")}
                  onValueChange={(v) =>
                    setForm({ ...form, grade_id: v ? +v : null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Belum disortir" />
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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>
                  Ekor {!editing && <span className="text-rose-500">*</span>}
                </Label>
                <Input
                  type="number"
                  min={1}
                  disabled={!!editing}
                  value={form.count || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      count: e.target.value ? +e.target.value : 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ukuran (cm)</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={form.size_cm ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      size_cm: e.target.value ? +e.target.value : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>s/d (cm)</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  placeholder="opsional"
                  value={form.size_max_cm ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      size_max_cm: e.target.value ? +e.target.value : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Harga per ekor</Label>
              <PriceShortcutInput
                value={form.price_per_fish}
                onChange={(v) => setForm({ ...form, price_per_fish: v })}
              />
              <p className="text-[11px] text-muted-foreground">
                Bisa input ringkas: <code>1.5 jt</code>, <code>350 rb</code>,
                atau angka penuh.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                rows={2}
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
              disabled={create.isPending || update.isPending}
              onClick={submit}
            >
              {editing ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
