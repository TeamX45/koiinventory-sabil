import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { ExpenseCategoriesApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { PageHeader, DataTable, type Column } from "@/components/common";
import { Button } from "@/components/ui/button";
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
import type { ExpenseCategory } from "@/types/models";

interface FormState {
  name: string;
  icon: string;
  description: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  name: "",
  icon: "",
  description: "",
  is_active: true,
};

export default function ExpenseCategoriesPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: ExpenseCategoriesApi.list,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const create = useMutation({
    mutationFn: ExpenseCategoriesApi.create,
    onSuccess: () => {
      success({
        title: "Kategori Ditambahkan",
        message: "Kategori pengeluaran tersimpan.",
      });
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menambah kategori."));
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<ExpenseCategory> }) =>
      ExpenseCategoriesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["expense-categories"] });
      const previous = qc.getQueryData<ExpenseCategory[]>(["expense-categories"]);
      qc.setQueryData<ExpenseCategory[]>(["expense-categories"], (old) =>
        (old ?? []).map((c) => (c.id === vars.id ? { ...c, ...vars.payload } : c)),
      );
      success({
        title: "Kategori Diperbarui",
        message: "Perubahan tersimpan.",
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["expense-categories"], ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui kategori."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["expense-categories"] }),
  });

  const remove = useMutation({
    mutationFn: ExpenseCategoriesApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["expense-categories"] });
      const previous = qc.getQueryData<ExpenseCategory[]>(["expense-categories"]);
      qc.setQueryData<ExpenseCategory[]>(["expense-categories"], (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      success({
        title: "Kategori Dihapus",
        message: "Kategori berhasil dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["expense-categories"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus kategori."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["expense-categories"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: ExpenseCategory) {
    setEditing(c);
    setForm({
      name: c.name,
      icon: c.icon ?? "",
      description: c.description ?? "",
      is_active: c.is_active,
    });
    setOpen(true);
  }

  function submit() {
    const isEditing = editing;
    const payload = form;
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (isEditing) {
      update.mutate({ id: isEditing.id, payload });
    } else {
      create.mutate(payload);
    }
  }

  async function handleDelete(c: ExpenseCategory) {
    if ((c.expenses_count ?? 0) > 0) {
      toast.error(
        `${c.name} masih dipakai ${c.expenses_count} pengeluaran. Hapus dulu pengeluaran-nya.`,
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

  const columns: Column<ExpenseCategory>[] = [
    {
      key: "name",
      header: "Nama",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Tags className="h-3.5 w-3.5 text-violet-500" />
          {row.name}
        </span>
      ),
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
      key: "is_active",
      header: "Status",
      cell: (row) =>
        row.is_active ? (
          <span className="text-[12px] text-emerald-600 dark:text-emerald-400">
            Aktif
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground">Nonaktif</span>
        ),
    },
    {
      key: "expenses_count",
      header: "Dipakai",
      headerClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <span
          className={
            row.expenses_count
              ? "font-mono font-semibold"
              : "font-mono text-muted-foreground/60"
          }
        >
          {formatNumber(row.expenses_count ?? 0)}
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
        title="Kategori Pengeluaran"
        description="Tambah/ubah kategori biaya operasional kolam"
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
              {editing ? `Edit ${editing.name}` : "Tambah Kategori Pengeluaran"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah detail kategori."
                : "Kategori baru untuk pengelompokan pengeluaran (mis. Listrik, WiFi, Pakan)."}
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
                placeholder="mis. Token Listrik, Bayar Ojek, dll"
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
                placeholder="Penjelasan kapan kategori ini dipakai (opsional)"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <div>
                <Label className="cursor-pointer">Aktif</Label>
                <p className="text-[11px] text-muted-foreground">
                  Kategori nonaktif tidak muncul di pilihan saat input pengeluaran
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) =>
                  setForm({ ...form, is_active: v })
                }
              />
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
