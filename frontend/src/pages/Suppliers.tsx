import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Phone, MapPin, Pencil, Trash2 } from "lucide-react";
import { SuppliersApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { PageHeader, DataTable, type Column } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Supplier } from "@/types/models";
import { extractApiError } from "@/utils/api-error";

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: SuppliersApi.list,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>({ is_active: true });

  const create = useMutation({
    mutationFn: SuppliersApi.create,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["suppliers"] });
      const previous = qc.getQueryData<Supplier[]>(["suppliers"]);
      const tempId = -Date.now();
      const optimistic = { id: tempId, ...payload } as Supplier;
      qc.setQueryData<Supplier[]>(["suppliers"], (old) => [optimistic, ...(old ?? [])]);
      setOpen(false);
      setEditing(null);
      setForm({ is_active: true });
      success({
        title: "Supplier Ditambahkan",
        message: `${payload.name} berhasil disimpan ke daftar supplier.`,
      });
      return { previous, tempId };
    },
    onSuccess: (data, _vars, ctx) => {
      qc.setQueryData<Supplier[]>(["suppliers"], (old) =>
        (old ?? []).map((s) => (s.id === ctx?.tempId ? data : s)),
      );
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["suppliers"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menambah supplier."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<Supplier> }) =>
      SuppliersApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["suppliers"] });
      const previous = qc.getQueryData<Supplier[]>(["suppliers"]);
      qc.setQueryData<Supplier[]>(["suppliers"], (old) =>
        (old ?? []).map((s) => (s.id === vars.id ? { ...s, ...vars.payload } : s)),
      );
      setOpen(false);
      setEditing(null);
      setForm({ is_active: true });
      success({
        title: "Supplier Diperbarui",
        message: `Perubahan untuk ${vars.payload.name ?? "supplier"} berhasil disimpan.`,
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["suppliers"], ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui supplier."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  const remove = useMutation({
    mutationFn: SuppliersApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["suppliers"] });
      const previous = qc.getQueryData<Supplier[]>(["suppliers"]);
      qc.setQueryData<Supplier[]>(["suppliers"], (old) =>
        (old ?? []).filter((s) => s.id !== id),
      );
      success({
        title: "Supplier Dihapus",
        message: "Data supplier berhasil dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["suppliers"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus supplier."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ is_active: true });
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      location: s.location,
      phone: s.phone,
      is_active: s.is_active,
    });
    setOpen(true);
  }

  function submit() {
    const data = form;
    const isEditing = editing;
    setOpen(false);
    setEditing(null);
    setForm({ is_active: true });
    if (isEditing) {
      update.mutate({ id: isEditing.id, payload: data });
    } else {
      create.mutate(data);
    }
  }

  async function handleDelete(s: Supplier) {
    const ok = await confirmDelete({
      title: `Hapus ${s.name}?`,
      description: `Pemasok "${s.name}" akan dihapus permanen. Data PO yang sudah ada tidak terpengaruh.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(s.id);
  }

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Nama",
      sortable: true,
    },
    {
      key: "location",
      header: "Lokasi",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {row.location ?? "-"}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Telepon",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Phone className="h-3 w-3" />
          {row.phone ?? "-"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      cell: (row) => (
        <Badge
          variant={row.is_active ? "default" : "outline"}
          className={
            row.is_active
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent"
              : ""
          }
        >
          {row.is_active ? "aktif" : "non-aktif"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      headerClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => openEdit(row)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(row)} title="Hapus">
            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier"
        description="Pemasok ikan koi dari sistem borong"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Supplier
          </Button>
        }
      />

      <DataTable
        data={data ?? []}
        columns={columns}
        keyExtractor={(s) => String(s.id)}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Cari supplier..."
        emptyMessage="Belum ada supplier. Tambahkan yang pertama."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Supplier" : "Tambah Supplier"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Edit data ${editing.name}`
                : "Data pemasok untuk pencatatan pembelian borong"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nama <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama petani / pemasok"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="loc">Lokasi</Label>
                <Input
                  id="loc"
                  value={form.location ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="Kota / Desa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telepon</Label>
                <Input
                  id="phone"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="08xx xxxx xxxx"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={!form.name}
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
