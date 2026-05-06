import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Ban, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { SalesApi, BatchesApi, MasterApi } from "@/api/endpoints";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  GlassCard,
  Pagination,
  type Column,
} from "@/components/common";
import type { StatusVariant } from "@/components/common";
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
import { formatRp, formatDate, formatNumber } from "@/utils/format";
import type { Sale, PaginatedResponse } from "@/types/models";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "default",
  paid: "info",
  shipped: "secondary",
  completed: "success",
  cancelled: "danger",
};

interface SaleItemRow {
  batch_id: number;
  count: number;
  price_per_fish: number;
}

export default function SalesPage() {
  const qc = useQueryClient();
  const { success, confirm, confirmDelete, dismissSuccess } = useFeedback();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["sales", { page }],
    queryFn: () => SalesApi.list({ page }),
    placeholderData: (prev) => prev,
  });
  const sales = data?.data ?? [];
  const meta = data?.meta;
  const { data: channels } = useQuery({
    queryKey: ["sales-channels"],
    queryFn: MasterApi.salesChannels,
  });
  const { data: batches } = useQuery({
    queryKey: ["batches", "sellable-all"],
    queryFn: () => BatchesApi.listAll({ status: "active" }),
  });
  const sellable = useMemo(
    () =>
      (batches ?? []).filter(
        (b) => b.grade_id !== null && b.price_per_fish !== null
      ),
    [batches]
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    sales_channel_id: 0,
    sale_date: new Date().toISOString().slice(0, 10),
    customer_name: "",
    customer_phone: "",
    discount: 0,
    shipping_cost: 0,
    notes: "",
    status: "draft",
  });
  const [items, setItems] = useState<SaleItemRow[]>([
    { batch_id: 0, count: 0, price_per_fish: 0 },
  ]);

  const [editing, setEditing] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState({ status: "draft", notes: "" });

  const subtotal = items.reduce(
    (s, i) => s + i.count * i.price_per_fish,
    0
  );
  const total = subtotal - (form.discount || 0) + (form.shipping_cost || 0);

  const create = useMutation({
    mutationFn: SalesApi.create,
    onMutate: (payload) => {
      // Optimistic: tambah baris ke tabel langsung (cuma di halaman 1)
      if (page === 1) {
        const tempId = -Date.now();
        const channel = channels?.find((c) => c.id === payload.sales_channel_id);
        const subtotal = payload.items.reduce(
          (s, i) => s + i.count * i.price_per_fish,
          0,
        );
        const total = subtotal - (payload.discount ?? 0) + (payload.shipping_cost ?? 0);
        const optimistic = {
          id: tempId,
          code: "...",
          sale_date: payload.sale_date,
          sales_channel_id: payload.sales_channel_id,
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone,
          subtotal,
          discount: payload.discount ?? 0,
          shipping_cost: payload.shipping_cost ?? 0,
          total,
          status: payload.status ?? "draft",
          channel,
          items: [],
        } as unknown as Sale;
        qc.setQueryData<PaginatedResponse<Sale>>(
          ["sales", { page: 1 }],
          (old) =>
            old
              ? { ...old, data: [optimistic, ...old.data], meta: { ...old.meta, total: old.meta.total + 1 } }
              : old,
        );
      } else {
        // Kalau user di halaman lain, lompat ke halaman 1 supaya bisa lihat row baru
        setPage(1);
      }
      success({
        title: "Penjualan Tersimpan",
        message: `Penjualan berhasil dicatat. Stok ikan otomatis berkurang.`,
      });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal simpan penjualan."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: typeof editForm }) =>
      SalesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      const key = ["sales", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Sale>>(key);
      qc.setQueryData<PaginatedResponse<Sale>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((s) =>
                s.id === vars.id ? ({ ...s, ...vars.payload } as Sale) : s,
              ),
            }
          : old,
      );
      success({
        title: "Penjualan Diperbarui",
        message: "Perubahan penjualan berhasil disimpan.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui penjualan."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });

  const cancel = useMutation({
    mutationFn: SalesApi.cancel,
    onMutate: async (id) => {
      const key = ["sales", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Sale>>(key);
      qc.setQueryData<PaginatedResponse<Sale>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((s) =>
                s.id === id ? ({ ...s, status: "cancelled" } as Sale) : s,
              ),
            }
          : old,
      );
      success({ title: "Penjualan Dibatalkan", message: "Stok ikan dikembalikan." });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal membatalkan penjualan."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  const remove = useMutation({
    mutationFn: SalesApi.delete,
    onMutate: async (id) => {
      const key = ["sales", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Sale>>(key);
      qc.setQueryData<PaginatedResponse<Sale>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((s) => s.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      success({ title: "Penjualan Dihapus", message: "Catatan penjualan berhasil dihapus." });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus penjualan."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  function openEdit(s: Sale) {
    setEditing(s);
    setEditForm({ status: s.status, notes: "" });
  }

  async function handleCancel(s: Sale) {
    const ok = await confirm({
      title: `Batalkan penjualan?`,
      description: `Penjualan tanggal ${formatDate(s.sale_date)} akan dibatalkan dan stok ikan dikembalikan.`,
      confirmLabel: "Ya, Batalkan",
      cancelLabel: "Tidak",
    });
    if (ok) cancel.mutate(s.id);
  }

  async function handleDelete(s: Sale) {
    const ok = await confirmDelete({
      title: `Hapus penjualan?`,
      description: `Catatan penjualan tanggal ${formatDate(s.sale_date)} akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(s.id);
  }

  function reset() {
    setForm({
      sales_channel_id: 0,
      sale_date: new Date().toISOString().slice(0, 10),
      customer_name: "",
      customer_phone: "",
      discount: 0,
      shipping_cost: 0,
      notes: "",
      status: "draft",
    });
    setItems([{ batch_id: 0, count: 0, price_per_fish: 0 }]);
  }

  function autofillFromBatch(idx: number, batchId: number) {
    const b = sellable.find((x) => x.id === batchId);
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              batch_id: batchId,
              price_per_fish: b ? Number(b.price_per_fish) : 0,
            }
          : it
      )
    );
  }

  const columns: Column<Sale>[] = [
    {
      key: "sale_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="font-medium">{formatDate(row.sale_date)}</span>
      ),
    },
    {
      key: "channel",
      header: "Saluran",
      cell: (row) => row.channel?.name ?? "-",
    },
    {
      key: "customer_name",
      header: "Pelanggan",
      cell: (row) => row.customer_name ?? "-",
    },
    {
      key: "total",
      header: "Total",
      headerClassName: "text-right",
      className: "text-right font-mono font-semibold",
      cell: (row) => formatRp(row.total),
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
      cell: (row) => {
        const canEdit = row.status !== "cancelled" && row.status !== "completed";
        const canCancelOrDelete = row.status === "draft";
        return (
          <div className="flex justify-end gap-1">
            <Button size="icon-sm" variant="ghost" asChild title="Cetak struk">
              <Link to={`/sales/${row.id}/receipt`}>
                <Printer className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {canEdit && (
              <Button size="icon-sm" variant="ghost" onClick={() => openEdit(row)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canCancelOrDelete && (
              <>
                <Button size="icon-sm" variant="ghost" onClick={() => handleCancel(row)} title="Batalkan">
                  <Ban className="h-3.5 w-3.5 text-amber-500" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(row)} title="Hapus">
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penjualan"
        description="Penjualan ikan ke marketplace, sosmed, atau offline"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Buat Penjualan
          </Button>
        }
      />

      <DataTable
        data={sales}
        columns={columns}
        keyExtractor={(s) => String(s.id)}
        isLoading={isLoading}
        emptyMessage="Belum ada penjualan."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Penjualan</DialogTitle>
            <DialogDescription>
              Multi-batch — stok otomatis berkurang & audit trail tercatat
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>
                  Saluran Penjualan <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={String(form.sales_channel_id || "")}
                  onValueChange={(v) =>
                    setForm({ ...form, sales_channel_id: +v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih saluran" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
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
                  value={form.sale_date}
                  onChange={(e) =>
                    setForm({ ...form, sale_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draf</SelectItem>
                    <SelectItem value="paid">Lunas</SelectItem>
                    <SelectItem value="shipped">Dikirim</SelectItem>
                    <SelectItem value="completed">Selesai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nama Pelanggan</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) =>
                    setForm({ ...form, customer_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Telepon</Label>
                <Input
                  value={form.customer_phone}
                  onChange={(e) =>
                    setForm({ ...form, customer_phone: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Item Penjualan</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setItems([
                      ...items,
                      { batch_id: 0, count: 0, price_per_fish: 0 },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Item
                </Button>
              </div>
              {sellable.length === 0 ? (
                <GlassCard variant="subtle" className="!py-4 text-center text-sm text-muted-foreground">
                  Belum ada batch yang dapat dijual. Sortir batch dulu untuk
                  memberi grade & harga.
                </GlassCard>
              ) : (
                <div className="space-y-2">
                  {items.map((it, i) => {
                    const b = sellable.find((x) => x.id === it.batch_id);
                    return (
                      <GlassCard variant="subtle" key={i} className="!py-3">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-12 sm:col-span-6 space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider">
                              Batch
                            </Label>
                            <Select
                              value={String(it.batch_id || "")}
                              onValueChange={(v) =>
                                autofillFromBatch(i, +v)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih batch" />
                              </SelectTrigger>
                              <SelectContent>
                                {sellable.map((b) => (
                                  <SelectItem key={b.id} value={String(b.id)}>
                                    {b.code} • {b.grade?.name} • {b.pond?.name}{" "}
                                    • {formatNumber(b.current_count)} ekor •{" "}
                                    {formatRp(b.price_per_fish)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-5 sm:col-span-2 space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider">
                              Ekor
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              max={b?.current_count}
                              value={it.count || ""}
                              onChange={(e) =>
                                setItems(
                                  items.map((x, idx) =>
                                    idx === i
                                      ? { ...x, count: +e.target.value }
                                      : x
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="col-span-6 sm:col-span-3 space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider">
                              Harga/ekor
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={it.price_per_fish || ""}
                              onChange={(e) =>
                                setItems(
                                  items.map((x, idx) =>
                                    idx === i
                                      ? {
                                          ...x,
                                          price_per_fish: +e.target.value,
                                        }
                                      : x
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() =>
                                setItems(
                                  items.filter((_, idx) => idx !== i)
                                )
                              }
                              disabled={items.length === 1}
                            >
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          </div>
                        </div>
                        {it.count > 0 && it.price_per_fish > 0 && (
                          <div className="mt-2 text-[11px] text-right text-muted-foreground">
                            Subtotal:{" "}
                            <span className="font-mono font-semibold text-foreground">
                              {formatRp(it.count * it.price_per_fish)}
                            </span>
                          </div>
                        )}
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </div>

            <GlassCard gradient="amber">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="space-y-2">
                  <Label>Diskon</Label>
                  <Input
                    type="number"
                    value={form.discount}
                    onChange={(e) =>
                      setForm({ ...form, discount: +e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ongkir</Label>
                  <Input
                    type="number"
                    value={form.shipping_cost}
                    onChange={(e) =>
                      setForm({ ...form, shipping_cost: +e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea
                    rows={1}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="border-t border-border/50 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatRp(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Diskon</span>
                  <span className="font-mono">
                    −{formatRp(form.discount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Ongkir</span>
                  <span className="font-mono">
                    +{formatRp(form.shipping_cost || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-border/50">
                  <span className="font-medium">Total</span>
                  <span className="font-mono font-bold text-gradient-amber">
                    {formatRp(total)}
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                !form.sales_channel_id ||
                items.some(
                  (i) => !i.batch_id || !i.count || i.price_per_fish < 0
                )
              }
              onClick={() => {
                const payload = { ...form, items };
                setOpen(false);
                reset();
                create.mutate(payload);
              }}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Penjualan</DialogTitle>
            <DialogDescription>
              Ubah status atau catatan penjualan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draf</SelectItem>
                  <SelectItem value="paid">Lunas</SelectItem>
                  <SelectItem value="shipped">Dikirim</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                if (!editing) return;
                const id = editing.id;
                const payload = editForm;
                setEditing(null);
                update.mutate({ id, payload });
              }}
            >
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
