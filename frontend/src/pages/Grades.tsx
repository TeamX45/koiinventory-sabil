import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Award } from "lucide-react";
import { GradesApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { PageHeader, DataTable, type Column } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Grade } from "@/types/models";

interface FormState {
  name: string;
  rank: number;
  description: string;
}

const emptyForm: FormState = {
  name: "",
  rank: 1,
  description: "",
};

export default function GradesPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ["grades"],
    queryFn: GradesApi.list,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const create = useMutation({
    mutationFn: GradesApi.create,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["grades"] });
      const previous = qc.getQueryData<Grade[]>(["grades"]);
      const tempId = -Date.now();
      const optimistic = {
        id: tempId,
        code: "...",
        ...payload,
      } as Grade;
      qc.setQueryData<Grade[]>(["grades"], (old) =>
        [optimistic, ...(old ?? [])].sort((a, b) => a.rank - b.rank),
      );
      success({
        title: "Grade Ditambahkan",
        message: `${payload.name} berhasil disimpan.`,
      });
      return { previous, tempId };
    },
    onSuccess: (data, _vars, ctx) => {
      qc.setQueryData<Grade[]>(["grades"], (old) =>
        (old ?? []).map((g) => (g.id === ctx?.tempId ? data : g)),
      );
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["grades"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menambah grade."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["grades"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<Grade> }) =>
      GradesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["grades"] });
      const previous = qc.getQueryData<Grade[]>(["grades"]);
      qc.setQueryData<Grade[]>(["grades"], (old) =>
        (old ?? [])
          .map((g) => (g.id === vars.id ? { ...g, ...vars.payload } : g))
          .sort((a, b) => a.rank - b.rank),
      );
      success({
        title: "Grade Diperbarui",
        message: "Perubahan grade berhasil disimpan.",
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["grades"], ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui grade."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["grades"] }),
  });

  const remove = useMutation({
    mutationFn: GradesApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["grades"] });
      const previous = qc.getQueryData<Grade[]>(["grades"]);
      qc.setQueryData<Grade[]>(["grades"], (old) =>
        (old ?? []).filter((g) => g.id !== id),
      );
      success({
        title: "Grade Dihapus",
        message: "Grade berhasil dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["grades"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus grade."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["grades"] }),
  });

  function openCreate() {
    setEditing(null);
    const nextRank =
      Math.max(0, ...(data ?? []).map((g) => g.rank ?? 0)) + 1;
    setForm({ ...emptyForm, rank: nextRank });
    setOpen(true);
  }

  function openEdit(g: Grade) {
    setEditing(g);
    setForm({
      name: g.name,
      rank: g.rank,
      description: (g as Grade & { description?: string }).description ?? "",
    });
    setOpen(true);
  }

  function submit() {
    const payload = form;
    const isEditing = editing;
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (isEditing) {
      update.mutate({ id: isEditing.id, payload });
    } else {
      create.mutate(payload);
    }
  }

  async function handleDelete(g: Grade) {
    const ok = await confirmDelete({
      title: `Hapus ${g.name}?`,
      description: `Grade ${g.name} akan dihapus permanen. Kalau masih dipakai baris ikan, sistem akan menolak.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(g.id);
  }

  const columns: Column<Grade>[] = [
    {
      key: "rank",
      header: "Urutan",
      headerClassName: "w-16",
      className: "w-16",
      cell: (row) => (
        <Badge variant="outline" className="font-mono">
          #{row.rank}
        </Badge>
      ),
    },
    {
      key: "name",
      header: "Nama",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Award className="h-3.5 w-3.5 text-amber-500" />
          {row.name}
        </span>
      ),
    },
    {
      key: "description",
      header: "Deskripsi",
      cell: (row) => (
        <span className="text-[12px] text-muted-foreground line-clamp-2">
          {(row as Grade & { description?: string }).description ?? "—"}
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
        title="Grade"
        description="Klasifikasi kualitas ikan — show, A, B, dst. Urutan menentukan ranking."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Grade
          </Button>
        }
      />

      <DataTable
        data={data ?? []}
        columns={columns}
        keyExtractor={(g) => String(g.id)}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Cari grade..."
        emptyMessage="Belum ada grade."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : "Tambah Grade"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah detail grade. Kode (auto) tidak bisa diubah."
                : "Grade baru untuk klasifikasi kualitas ikan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>
                  Nama <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Show Quality"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Urutan <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.rank || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rank: e.target.value ? +e.target.value : 1,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Penjelasan kriteria grade (opsional)"
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              Urutan dipakai sortir di dropdown — angka kecil = grade lebih
              tinggi. Mis. Show=1, Grade A=2, Grade B=3.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button disabled={!form.name || !form.rank} onClick={submit}>
              {editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
