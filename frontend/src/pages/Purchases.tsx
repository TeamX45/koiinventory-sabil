import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PackageCheck, Pencil, Trash2 } from "lucide-react";
import { PurchasesApi, SuppliersApi, PondsApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Pagination,
  type Column,
} from "@/components/common";
import type { StatusVariant } from "@/components/common";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Purchase, PaginatedResponse } from "@/types/models";
import { formatRp, formatDate, formatNumber } from "@/utils/format";
import { extractApiError } from "@/utils/api-error";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  pending: "warning",
  received: "info",
  sorted: "success",
  cancelled: "danger",
};

export default function PurchasesPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["purchases", { page }],
    queryFn: () => PurchasesApi.list({ page }),
    placeholderData: (prev) => prev,
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: SuppliersApi.list,
  });
  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });

  const purchases = data?.data ?? [];
  const meta = data?.meta;

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [openReceive, setOpenReceive] = useState<number | null>(null);
  const emptyForm = {
    supplier_id: 0,
    purchase_date: new Date().toISOString().slice(0, 10),
    total_count: 0,
    subtotal: 0,
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [receivePondId, setReceivePondId] = useState(0);

  const create = useMutation({
    mutationFn: PurchasesApi.create,
    onMutate: (payload) => {
      if (page === 1) {
        const tempId = -Date.now();
        const supplier = suppliers?.find((s) => s.id === payload.supplier_id);
        const subtotal = Number(payload.subtotal) || 0;
        const total_count = Number(payload.total_count) || 0;
        const optimistic = {
          id: tempId,
          code: "...",
          status: "pending",
          supplier,
          subtotal,
          total_count,
          avg_price_per_fish: total_count > 0 ? subtotal / total_count : 0,
          ...payload,
        } as unknown as Purchase;
        qc.setQueryData<PaginatedResponse<Purchase>>(
          ["purchases", { page: 1 }],
          (old) =>
            old
              ? { ...old, data: [optimistic, ...old.data], meta: { ...old.meta, total: old.meta.total + 1 } }
              : old,
        );
      } else {
        setPage(1);
      }
      success({
        title: "PO Dibuat",
        message: `Purchase Order berhasil disimpan dengan ${payload.total_count} ekor.`,
      });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal membuat PO."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["purchases"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: typeof form }) =>
      PurchasesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      const key = ["purchases", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Purchase>>(key);
      qc.setQueryData<PaginatedResponse<Purchase>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((p) =>
                p.id === vars.id ? ({ ...p, ...vars.payload } as Purchase) : p,
              ),
            }
          : old,
      );
      success({
        title: "PO Diperbarui",
        message: "Perubahan PO berhasil disimpan.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui PO."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["purchases"] }),
  });

  const remove = useMutation({
    mutationFn: PurchasesApi.delete,
    onMutate: async (id) => {
      const key = ["purchases", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Purchase>>(key);
      qc.setQueryData<PaginatedResponse<Purchase>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((p) => p.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      success({
        title: "PO Dihapus",
        message: "Purchase Order berhasil dihapus.",
      });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus PO."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["purchases"] }),
  });

  const receive = useMutation({
    mutationFn: ({ id, pond_id }: { id: number; pond_id: number }) =>
      PurchasesApi.receive(id, { pond_id }),
    onMutate: async ({ id }) => {
      const key = ["purchases", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Purchase>>(key);
      qc.setQueryData<PaginatedResponse<Purchase>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((p) =>
                p.id === id ? ({ ...p, status: "received" } as Purchase) : p,
              ),
            }
          : old,
      );
      success({
        title: "Barang Diterima",
        message: "Batch ikan berhasil dibuat di kolam staging dan siap untuk disortir.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal terima."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  function openCreateModal() {
    setEditing(null);
    setForm(emptyForm);
    setOpenCreate(true);
  }

  function openEdit(p: Purchase) {
    setEditing(p);
    setForm({
      supplier_id: p.supplier_id,
      purchase_date: p.purchase_date.slice(0, 10),
      total_count: p.total_count,
      subtotal: typeof p.subtotal === "string" ? parseFloat(p.subtotal) : p.subtotal,
      notes: "",
    });
    setOpenCreate(true);
  }

  function submitCreateOrEdit() {
    const data = form;
    const isEditing = editing;
    // Tutup modal & reset form INSTAN, tidak menunggu mutation
    setOpenCreate(false);
    setEditing(null);
    setForm(emptyForm);
    if (isEditing) {
      update.mutate({ id: isEditing.id, payload: data });
    } else {
      create.mutate(data);
    }
  }

  async function handleDelete(p: Purchase) {
    const ok = await confirmDelete({
      title: `Hapus PO ${formatDate(p.purchase_date)}?`,
      description: `PO dari ${p.supplier?.name ?? "-"} (${p.total_count} ekor) akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(p.id);
  }

  const columns: Column<Purchase>[] = [
    {
      key: "purchase_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="font-medium">{formatDate(row.purchase_date)}</span>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      cell: (row) => row.supplier?.name ?? "-",
    },
    {
      key: "total_count",
      header: "Ekor",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => formatNumber(row.total_count),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => formatRp(row.subtotal),
    },
    {
      key: "avg_price_per_fish",
      header: "Avg/ekor",
      headerClassName: "text-right",
      className: "text-right font-mono text-muted-foreground",
      cell: (row) => formatRp(row.avg_price_per_fish),
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
          {row.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenReceive(row.id)}
                title="Terima barang"
              >
                <PackageCheck className="h-3.5 w-3.5" />
                Terima
              </Button>
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
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pembelian Borong"
        description="PO dari supplier — sistem borong (per ekor diset saat sortir)"
        actions={
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Buat PO
          </Button>
        }
      />

      <DataTable
        data={purchases}
        columns={columns}
        keyExtractor={(p) => String(p.id)}
        isLoading={isLoading}
        emptyMessage="Belum ada PO."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pembelian" : "Buat Pembelian"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Edit data PO yang masih pending. PO yang sudah received tidak bisa diubah."
                : "Pencatatan pembelian borong — total ekor + subtotal"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Supplier <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(form.supplier_id || "")}
                  onValueChange={(v) =>
                    setForm({ ...form, supplier_id: +v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Tanggal <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) =>
                    setForm({ ...form, purchase_date: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Total Ekor <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  value={form.total_count || ""}
                  onChange={(e) =>
                    setForm({ ...form, total_count: +e.target.value })
                  }
                  placeholder="25"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Subtotal Borong <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  value={form.subtotal || ""}
                  onChange={(e) =>
                    setForm({ ...form, subtotal: +e.target.value })
                  }
                  placeholder="25000000"
                />
                {form.total_count > 0 && form.subtotal > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    ≈ {formatRp(form.subtotal / form.total_count)} / ekor
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Opsional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Batal
            </Button>
            <Button
              disabled={
                !form.supplier_id ||
                !form.total_count ||
                !form.subtotal
              }
              onClick={submitCreateOrEdit}
            >
              {editing ? "Simpan Perubahan" : "Simpan PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openReceive !== null}
        onOpenChange={(o) => !o && setOpenReceive(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terima Pembelian</DialogTitle>
            <DialogDescription>
              Tentukan kolam staging tempat ikan masuk
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>
              Kolam Staging <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={String(receivePondId || "")}
              onValueChange={(v) => setReceivePondId(+v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih kolam" />
              </SelectTrigger>
              <SelectContent>
                {ponds?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReceive(null)}>
              Batal
            </Button>
            <Button
              disabled={!receivePondId}
              onClick={() => {
                const id = openReceive!;
                const pond_id = receivePondId;
                setOpenReceive(null);
                setReceivePondId(0);
                receive.mutate({ id, pond_id });
              }}
            >
              Receive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
