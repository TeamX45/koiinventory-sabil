import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";
import { LocationsApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { PageHeader, DataTable, type Column } from "@/components/common";
import { Button } from "@/components/ui/button";
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
import { formatNumber } from "@/utils/format";
import type { Location } from "@/types/models";

interface FormState {
  name: string;
  address: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  address: "",
  notes: "",
};

export default function LocationsPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: LocationsApi.list,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const create = useMutation({
    mutationFn: LocationsApi.create,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["locations"] });
      const previous = qc.getQueryData<Location[]>(["locations"]);
      const tempId = -Date.now();
      const optimistic = { id: tempId, ponds_count: 0, ...payload } as Location;
      qc.setQueryData<Location[]>(["locations"], (old) => [optimistic, ...(old ?? [])]);
      success({
        title: "Lokasi Ditambahkan",
        message: `${payload.name} berhasil disimpan.`,
      });
      return { previous, tempId };
    },
    onSuccess: (data, _vars, ctx) => {
      qc.setQueryData<Location[]>(["locations"], (old) =>
        (old ?? []).map((l) => (l.id === ctx?.tempId ? data : l)),
      );
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["locations"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menambah lokasi."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<Location> }) =>
      LocationsApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["locations"] });
      const previous = qc.getQueryData<Location[]>(["locations"]);
      qc.setQueryData<Location[]>(["locations"], (old) =>
        (old ?? []).map((l) => (l.id === vars.id ? { ...l, ...vars.payload } : l)),
      );
      success({
        title: "Lokasi Diperbarui",
        message: "Perubahan lokasi berhasil disimpan.",
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["locations"], ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui lokasi."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });

  const remove = useMutation({
    mutationFn: LocationsApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["locations"] });
      const previous = qc.getQueryData<Location[]>(["locations"]);
      qc.setQueryData<Location[]>(["locations"], (old) =>
        (old ?? []).filter((l) => l.id !== id),
      );
      success({
        title: "Lokasi Dihapus",
        message: "Data lokasi berhasil dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["locations"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus lokasi."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(l: Location) {
    setEditing(l);
    setForm({
      name: l.name,
      address: l.address ?? "",
      notes: l.notes ?? "",
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

  async function handleDelete(l: Location) {
    if ((l.ponds_count ?? 0) > 0) {
      toast.error(
        `${l.name} masih dipakai ${l.ponds_count} kolam. Pindahkan/hapus kolam dulu.`,
      );
      return;
    }
    const ok = await confirmDelete({
      title: `Hapus ${l.name}?`,
      description: `Lokasi ${l.name} akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(l.id);
  }

  const columns: Column<Location>[] = [
    {
      key: "name",
      header: "Nama",
      sortable: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "address",
      header: "Alamat",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {row.address ?? "-"}
        </span>
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
        title="Lokasi"
        description="Lokasi fisik tempat kolam berada"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Lokasi
          </Button>
        }
      />

      <DataTable
        data={data ?? []}
        columns={columns}
        keyExtractor={(l) => String(l.id)}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Cari lokasi..."
        emptyMessage="Belum ada lokasi."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : "Tambah Lokasi"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah detail lokasi"
                : "Lokasi baru untuk menampung unit kolam"}
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
                placeholder="mis. Sukaraja, Ds. Keramat"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Alamat</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Detail alamat (opsional)"
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Opsional"
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
