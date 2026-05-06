import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Fish } from "lucide-react";
import { FishTypesApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { PageHeader, DataTable, type Column } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FishType } from "@/types/models";

interface FormState {
  name: string;
  group: "koi" | "penjinak";
}

const emptyForm: FormState = {
  name: "",
  group: "koi",
};

export default function FishTypesPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ["fish-types"],
    queryFn: FishTypesApi.list,
  });

  const [groupFilter, setGroupFilter] = useState<"all" | "koi" | "penjinak">(
    "all",
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FishType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (f) => groupFilter === "all" || f.group === groupFilter,
      ),
    [data, groupFilter],
  );

  const create = useMutation({
    mutationFn: FishTypesApi.create,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["fish-types"] });
      const previous = qc.getQueryData<FishType[]>(["fish-types"]);
      const tempId = -Date.now();
      const optimistic = {
        id: tempId,
        code: "...",
        ...payload,
      } as FishType;
      qc.setQueryData<FishType[]>(["fish-types"], (old) =>
        [...(old ?? []), optimistic].sort((a, b) =>
          a.group === b.group
            ? a.name.localeCompare(b.name)
            : a.group.localeCompare(b.group),
        ),
      );
      success({
        title: "Jenis Ikan Ditambah",
        message: `${payload.name} tersimpan.`,
      });
      return { previous, tempId };
    },
    onSuccess: (data, _vars, ctx) => {
      qc.setQueryData<FishType[]>(["fish-types"], (old) =>
        (old ?? []).map((f) => (f.id === ctx?.tempId ? data : f)),
      );
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["fish-types"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menambah jenis ikan."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["fish-types"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<FishType> }) =>
      FishTypesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["fish-types"] });
      const previous = qc.getQueryData<FishType[]>(["fish-types"]);
      qc.setQueryData<FishType[]>(["fish-types"], (old) =>
        (old ?? []).map((f) =>
          f.id === vars.id ? { ...f, ...vars.payload } : f,
        ),
      );
      success({
        title: "Jenis Ikan Diperbarui",
        message: "Perubahan tersimpan.",
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["fish-types"], ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui jenis ikan."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["fish-types"] }),
  });

  const remove = useMutation({
    mutationFn: FishTypesApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["fish-types"] });
      const previous = qc.getQueryData<FishType[]>(["fish-types"]);
      qc.setQueryData<FishType[]>(["fish-types"], (old) =>
        (old ?? []).filter((f) => f.id !== id),
      );
      success({
        title: "Jenis Ikan Dihapus",
        message: "Jenis ikan dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["fish-types"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus jenis ikan."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["fish-types"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(f: FishType) {
    setEditing(f);
    setForm({ name: f.name, group: f.group });
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

  async function handleDelete(f: FishType) {
    const ok = await confirmDelete({
      title: `Hapus ${f.name}?`,
      description: `Jenis ikan ${f.name} akan dihapus permanen. Kalau masih dipakai baris ikan, sistem akan menolak.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(f.id);
  }

  const columns: Column<FishType>[] = [
    {
      key: "name",
      header: "Nama",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Fish className="h-3.5 w-3.5 text-cyan-500" />
          {row.name}
        </span>
      ),
    },
    {
      key: "group",
      header: "Group",
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.group === "koi"
              ? "border-cyan-300 text-cyan-700 dark:text-cyan-400 bg-cyan-500/10"
              : "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-500/10"
          }
        >
          {row.group === "koi" ? "Koi" : "Penjinak"}
        </Badge>
      ),
    },
    {
      key: "code",
      header: "Kode",
      cell: (row) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {row.code}
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
        title="Jenis Ikan"
        description="Master data varietas ikan koi & penjinak — dipakai di form kolam, batch, dan opname"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Jenis
          </Button>
        }
      />

      <Tabs
        value={groupFilter}
        onValueChange={(v) => setGroupFilter(v as typeof groupFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">Semua ({data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="koi">
            Koi ({(data ?? []).filter((f) => f.group === "koi").length})
          </TabsTrigger>
          <TabsTrigger value="penjinak">
            Penjinak ({(data ?? []).filter((f) => f.group === "penjinak").length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(f) => String(f.id)}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Cari jenis (mis. Kohaku, Karasi)..."
        emptyMessage="Belum ada jenis ikan."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : "Tambah Jenis Ikan"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah nama atau group. Kode (auto) tidak bisa diubah."
                : "Tambah varietas ikan baru ke master."}
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
                placeholder="mis. Tancho Kohaku, Slayer Kohaku"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Group <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={form.group}
                onValueChange={(v) =>
                  setForm({ ...form, group: v as "koi" | "penjinak" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="koi">Koi (varietas show/grade)</SelectItem>
                  <SelectItem value="penjinak">
                    Penjinak (komoditas, bukan koi murni)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Group dipakai untuk filter laporan & dropdown.
              </p>
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
