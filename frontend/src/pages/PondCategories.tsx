import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Heart, Sprout } from "lucide-react";
import { PondCategoriesApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { PageHeader, DataTable, type Column } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/utils/format";
import type { PondCategory } from "@/types/models";

interface FormState {
  name: string;
  description: string;
  is_breeding: boolean;
  is_grow_out: boolean;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  is_breeding: false,
  is_grow_out: false,
};

export default function PondCategoriesPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ["pond-categories"],
    queryFn: PondCategoriesApi.list,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PondCategory | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const create = useMutation({
    mutationFn: PondCategoriesApi.create,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["pond-categories"] });
      const previous = qc.getQueryData<PondCategory[]>(["pond-categories"]);
      const tempId = -Date.now();
      const optimistic = {
        id: tempId,
        ponds_count: 0,
        is_breeding: false,
        is_grow_out: false,
        ...payload,
      } as PondCategory;
      qc.setQueryData<PondCategory[]>(["pond-categories"], (old) => [optimistic, ...(old ?? [])]);
      success({
        title: "Kategori Ditambahkan",
        message: `${payload.name} berhasil disimpan.`,
      });
      return { previous, tempId };
    },
    onSuccess: (data, _vars, ctx) => {
      qc.setQueryData<PondCategory[]>(["pond-categories"], (old) =>
        (old ?? []).map((c) => (c.id === ctx?.tempId ? data : c)),
      );
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["pond-categories"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menambah kategori."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pond-categories"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<PondCategory> }) =>
      PondCategoriesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["pond-categories"] });
      const previous = qc.getQueryData<PondCategory[]>(["pond-categories"]);
      qc.setQueryData<PondCategory[]>(["pond-categories"], (old) =>
        (old ?? []).map((c) => (c.id === vars.id ? { ...c, ...vars.payload } : c)),
      );
      success({
        title: "Kategori Diperbarui",
        message: "Perubahan kategori berhasil disimpan.",
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["pond-categories"], ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui kategori."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pond-categories"] }),
  });

  const remove = useMutation({
    mutationFn: PondCategoriesApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["pond-categories"] });
      const previous = qc.getQueryData<PondCategory[]>(["pond-categories"]);
      qc.setQueryData<PondCategory[]>(["pond-categories"], (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      success({
        title: "Kategori Dihapus",
        message: "Kategori kolam berhasil dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["pond-categories"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus kategori."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pond-categories"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: PondCategory) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description ?? "",
      is_breeding: c.is_breeding,
      is_grow_out: c.is_grow_out,
    });
    setOpen(true);
  }

  function submit() {
    const data = form;
    const isEditing = editing;
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (isEditing) {
      update.mutate({ id: isEditing.id, payload: data });
    } else {
      create.mutate(data);
    }
  }

  async function handleDelete(c: PondCategory) {
    if ((c.ponds_count ?? 0) > 0) {
      toast.error(
        `${c.name} masih dipakai ${c.ponds_count} kolam. Pindahkan/hapus kolam dulu.`,
      );
      return;
    }
    const ok = await confirmDelete({
      title: `Hapus ${c.name}?`,
      description: `Kategori ${c.name} akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(c.id);
  }

  const columns: Column<PondCategory>[] = [
    {
      key: "name",
      header: "Nama",
      sortable: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "description",
      header: "Deskripsi",
      cell: (row) => (
        <span className="text-[12px] text-muted-foreground line-clamp-2">
          {row.description ?? "—"}
        </span>
      ),
    },
    {
      key: "flags",
      header: "Sifat",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.is_breeding && (
            <Badge
              variant="outline"
              className="border-rose-300 text-rose-700 dark:text-rose-400 bg-rose-500/10"
            >
              <Heart className="h-3 w-3" />
              Breeding
            </Badge>
          )}
          {row.is_grow_out && (
            <Badge
              variant="outline"
              className="border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
            >
              <Sprout className="h-3 w-3" />
              Grow-out
            </Badge>
          )}
          {!row.is_breeding && !row.is_grow_out && (
            <Badge variant="outline" className="text-muted-foreground">
              Standar
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "ponds_count",
      header: "Kolam",
      headerClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <span
          className={
            row.ponds_count
              ? "font-mono font-semibold"
              : "font-mono text-muted-foreground/60"
          }
        >
          {formatNumber(row.ponds_count ?? 0)}
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
        title="Kategori Kolam"
        description="Klasifikasi fungsi kolam — indukan, jumbo, kontes, pembesaran, penangkaran"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Kategori
          </Button>
        }
      />

      <DataTable
        data={data ?? []}
        columns={columns}
        keyExtractor={(c) => String(c.id)}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Cari kategori..."
        emptyMessage="Belum ada kategori."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : "Tambah Kategori Kolam"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah detail kategori"
                : "Kategori baru untuk klasifikasi kolam"}
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
                placeholder="Indukan / Master"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Penjelasan fungsi kategori (opsional)"
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Breeding</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Untuk pemijahan / penangkaran indukan
                  </p>
                </div>
                <Switch
                  checked={form.is_breeding}
                  onCheckedChange={(v) =>
                    setForm({ ...form, is_breeding: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Grow-out</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Untuk pembesaran ikan dari kecil ke ukuran target
                  </p>
                </div>
                <Switch
                  checked={form.is_grow_out}
                  onCheckedChange={(v) =>
                    setForm({ ...form, is_grow_out: v })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button disabled={!form.name} onClick={submit}>
              {editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
