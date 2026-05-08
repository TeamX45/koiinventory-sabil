import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Ban, Printer, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import {
  SalesApi,
  BatchesApi,
  MasterApi,
  LocationsApi,
  PondsApi,
} from "@/api/endpoints";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  GlassCard,
  Pagination,
  PriceShortcutInput,
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
import {
  formatRp,
  formatRpShort,
  formatDate,
  formatNumber,
  formatSize,
} from "@/utils/format";
import type { Sale, PaginatedResponse, Batch } from "@/types/models";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "default",
  paid: "info",
  shipped: "secondary",
  completed: "success",
  cancelled: "danger",
};

interface SaleItemRow {
  id: string;            // local-only key
  pond_id: number;
  fish_type_id: number;
  batch_id: number;      // resolved from pond+fish_type
  count: number;
  size_cm: number | null;
  price_per_fish: number | null;
}

const newRow = (): SaleItemRow => ({
  id: Math.random().toString(36).slice(2),
  pond_id: 0,
  fish_type_id: 0,
  batch_id: 0,
  count: 0,
  size_cm: null,
  price_per_fish: null,
});

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
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: LocationsApi.list,
  });
  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });
  const { data: fishTypes } = useQuery({
    queryKey: ["fish-types"],
    queryFn: MasterApi.fishTypes,
  });
  const { data: batches } = useQuery({
    queryKey: ["batches", "sellable-all"],
    queryFn: () => BatchesApi.listAll({ status: "active" }),
  });

  const sellableBatches = useMemo(
    () => (batches ?? []).filter((b) => b.current_count > 0),
    [batches],
  );

  // Lookup: per kolam → list jenis ikan unik yang ada
  const fishTypesByPond = useMemo(() => {
    const m = new Map<number, Set<number>>();
    sellableBatches.forEach((b) => {
      if (!b.fish_type_id) return;
      if (!m.has(b.pond_id)) m.set(b.pond_id, new Set());
      m.get(b.pond_id)!.add(b.fish_type_id);
    });
    return m;
  }, [sellableBatches]);

  // Lookup: (pond_id + fish_type_id) → batches yang match (bisa multi karena beda ukuran/grade)
  function batchesFor(pondId: number, fishTypeId: number): Batch[] {
    return sellableBatches.filter(
      (b) => b.pond_id === pondId && b.fish_type_id === fishTypeId,
    );
  }

  const [open, setOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState(0);
  const [form, setForm] = useState({
    sales_channel_id: 0,
    sale_date: new Date().toISOString().slice(0, 10),
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    discount: 0,
    shipping_cost: 0,
    notes: "",
    status: "draft",
  });
  const [items, setItems] = useState<SaleItemRow[]>([newRow()]);

  const [editing, setEditing] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState({ status: "draft", notes: "" });

  // Ponds tersedia untuk dropdown (filter lokasi opsional)
  const availablePonds = useMemo(() => {
    if (!ponds) return [];
    return ponds
      .filter((p) => p.is_active !== false)
      .filter((p) => !locationFilter || p.location_id === locationFilter)
      .filter((p) => fishTypesByPond.has(p.id)) // hanya kolam yg punya ikan
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ponds, locationFilter, fishTypesByPond]);

  const subtotal = items.reduce(
    (s, i) => s + (i.count || 0) * (i.price_per_fish || 0),
    0,
  );
  const total = subtotal - (form.discount || 0) + (form.shipping_cost || 0);

  const itemsValid = items.every(
    (i) => i.batch_id > 0 && i.count > 0 && (i.price_per_fish ?? 0) > 0,
  );

  const create = useMutation({
    mutationFn: SalesApi.create,
    onMutate: (payload) => {
      if (page === 1) {
        const tempId = -Date.now();
        const channel = channels?.find((c) => c.id === payload.sales_channel_id);
        const sub = payload.items.reduce(
          (s, i) => s + i.count * i.price_per_fish,
          0,
        );
        const t = sub - (payload.discount ?? 0) + (payload.shipping_cost ?? 0);
        const optimistic = {
          id: tempId,
          code: "...",
          sale_date: payload.sale_date,
          sales_channel_id: payload.sales_channel_id,
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone,
          subtotal: sub,
          discount: payload.discount ?? 0,
          shipping_cost: payload.shipping_cost ?? 0,
          total: t,
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
        setPage(1);
      }
      success({
        title: "Penjualan Tersimpan",
        message: "Stok ikan otomatis berkurang.",
      });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal simpan penjualan."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
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
        message: "Perubahan tersimpan.",
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
      toast.error(extractApiError(e, "Gagal membatalkan."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
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
      success({ title: "Penjualan Dihapus", message: "Catatan penjualan dihapus." });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
    },
  });

  function openEdit(s: Sale) {
    setEditing(s);
    setEditForm({ status: s.status, notes: s.notes ?? "" });
  }

  async function handleCancel(s: Sale) {
    const ok = await confirm({
      title: "Batalkan penjualan?",
      description: `Penjualan tanggal ${formatDate(s.sale_date)} akan dibatalkan dan stok ikan dikembalikan.`,
      confirmLabel: "Ya, Batalkan",
      cancelLabel: "Tidak",
    });
    if (ok) cancel.mutate(s.id);
  }

  async function handleDelete(s: Sale) {
    const ok = await confirmDelete({
      title: "Hapus penjualan?",
      description: `Catatan penjualan tanggal ${formatDate(s.sale_date)} akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(s.id);
  }

  function resetForm() {
    setForm({
      sales_channel_id: 0,
      sale_date: new Date().toISOString().slice(0, 10),
      customer_name: "",
      customer_phone: "",
      customer_address: "",
      discount: 0,
      shipping_cost: 0,
      notes: "",
      status: "draft",
    });
    setItems([newRow()]);
    setLocationFilter(0);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function patchItem(idx: number, patch: Partial<SaleItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function changePond(idx: number, pondId: number) {
    // Reset jenis & batch saat ganti kolam
    patchItem(idx, {
      pond_id: pondId,
      fish_type_id: 0,
      batch_id: 0,
      size_cm: null,
      price_per_fish: null,
    });
  }

  function changeFishType(idx: number, fishTypeId: number) {
    const item = items[idx];
    const matches = batchesFor(item.pond_id, fishTypeId);
    // Auto-select kalau cuma 1 batch yg match
    if (matches.length === 1) {
      const b = matches[0];
      patchItem(idx, {
        fish_type_id: fishTypeId,
        batch_id: b.id,
        size_cm: b.size_cm,
        price_per_fish: b.price_per_fish ? Number(b.price_per_fish) : null,
      });
    } else {
      patchItem(idx, {
        fish_type_id: fishTypeId,
        batch_id: 0,
        size_cm: null,
        price_per_fish: null,
      });
    }
  }

  function changeBatch(idx: number, batchId: number) {
    const b = sellableBatches.find((x) => x.id === batchId);
    if (!b) return;
    patchItem(idx, {
      batch_id: batchId,
      size_cm: b.size_cm,
      price_per_fish: b.price_per_fish ? Number(b.price_per_fish) : null,
    });
  }

  function submit() {
    if (!form.sales_channel_id) {
      toast.error("Pilih saluran penjualan dulu.");
      return;
    }
    if (!itemsValid) {
      toast.error("Lengkapi item: kolam, jenis, jumlah, dan harga harus terisi.");
      return;
    }
    const payload = {
      ...form,
      items: items.map((i) => ({
        batch_id: i.batch_id,
        count: i.count,
        price_per_fish: i.price_per_fish!,
      })),
    };
    setOpen(false);
    resetForm();
    create.mutate(payload);
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
      cell: (row) => (
        <span className="text-[12px]">{row.channel?.name ?? "—"}</span>
      ),
    },
    {
      key: "customer_name",
      header: "Pelanggan",
      cell: (row) => (
        <div className="text-[12px]">
          <div className="font-medium">{row.customer_name || "—"}</div>
          {row.customer_phone && (
            <div className="text-muted-foreground/70">{row.customer_phone}</div>
          )}
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      headerClassName: "text-right",
      className: "text-right font-mono font-semibold",
      cell: (row) => (
        <span title={formatRp(row.total)}>{formatRpShort(row.total)}</span>
      ),
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
        description="Catat penjualan ikan — pilih kolam, lalu jenis ikan yang dijual"
        actions={
          <Button onClick={openCreate}>
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

      {/* CREATE MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Buat Penjualan</DialogTitle>
            <DialogDescription>
              Pilih kolam → jenis ikan → input jumlah & harga. Stok berkurang otomatis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Header sale: saluran, tanggal, status */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  Saluran <span className="text-rose-500">*</span>
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
                  onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
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

            {/* Pelanggan: opsional */}
            <details className="rounded-lg border border-border/50 bg-muted/10">
              <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground">
                Info Pelanggan (opsional)
              </summary>
              <div className="space-y-3 p-3 pt-0">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nama</Label>
                    <Input
                      value={form.customer_name}
                      onChange={(e) =>
                        setForm({ ...form, customer_name: e.target.value })
                      }
                      placeholder="Pelanggan umum"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telepon</Label>
                    <Input
                      value={form.customer_phone}
                      onChange={(e) =>
                        setForm({ ...form, customer_phone: e.target.value })
                      }
                      placeholder="08xx-xxxx-xxxx"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Alamat</Label>
                  <Textarea
                    rows={2}
                    value={form.customer_address}
                    onChange={(e) =>
                      setForm({ ...form, customer_address: e.target.value })
                    }
                    placeholder="Alamat pengiriman / catatan kontak"
                  />
                </div>
              </div>
            </details>

            {/* Filter lokasi (opsional, untuk persempit dropdown kolam) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Filter Lokasi (opsional)</Label>
                <Select
                  value={locationFilter ? String(locationFilter) : "all"}
                  onValueChange={(v) =>
                    setLocationFilter(v === "all" ? 0 : +v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua lokasi</SelectItem>
                    {locations?.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Item Penjualan</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setItems([...items, newRow()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Item
                </Button>
              </div>

              {availablePonds.length === 0 ? (
                <GlassCard
                  variant="subtle"
                  className="!py-4 text-center text-sm text-muted-foreground"
                >
                  Tidak ada kolam dengan ikan yang siap dijual. Pastikan ada
                  kolam aktif berisi baris ikan.
                </GlassCard>
              ) : (
                <div className="space-y-3">
                  {items.map((it, i) => {
                    const availableJenisIds = it.pond_id
                      ? Array.from(fishTypesByPond.get(it.pond_id) ?? [])
                      : [];
                    const availableJenis = (fishTypes ?? []).filter((f) =>
                      availableJenisIds.includes(f.id),
                    );
                    const matches = it.pond_id && it.fish_type_id
                      ? batchesFor(it.pond_id, it.fish_type_id)
                      : [];
                    const selectedBatch = sellableBatches.find(
                      (b) => b.id === it.batch_id,
                    );
                    const lineSubtotal = (it.count || 0) * (it.price_per_fish || 0);

                    return (
                      <GlassCard variant="subtle" key={it.id} className="!py-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Item #{i + 1}
                          </span>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              setItems(items.filter((_, idx) => idx !== i))
                            }
                            disabled={items.length === 1}
                            title="Hapus item"
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {/* Kolam */}
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              Kolam <span className="text-rose-500">*</span>
                            </Label>
                            <Select
                              value={it.pond_id ? String(it.pond_id) : ""}
                              onValueChange={(v) => changePond(i, +v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih kolam" />
                              </SelectTrigger>
                              <SelectContent>
                                {availablePonds.map((p) => {
                                  const total = sellableBatches
                                    .filter((b) => b.pond_id === p.id)
                                    .reduce((s, b) => s + b.current_count, 0);
                                  return (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                      {p.name} · {formatNumber(total)} ekor
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Jenis Ikan */}
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              Jenis Ikan <span className="text-rose-500">*</span>
                            </Label>
                            <Select
                              value={
                                it.fish_type_id ? String(it.fish_type_id) : ""
                              }
                              onValueChange={(v) => changeFishType(i, +v)}
                              disabled={!it.pond_id}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    it.pond_id
                                      ? "Pilih jenis"
                                      : "Pilih kolam dulu"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {availableJenis.map((f) => (
                                  <SelectItem key={f.id} value={String(f.id)}>
                                    {f.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Pilih variasi (hanya muncul kalau jenis punya >1 batch — beda ukuran/grade) */}
                        {matches.length > 1 && (
                          <div className="mt-3 space-y-1">
                            <Label className="text-[11px]">
                              Pilih Ukuran / Grade{" "}
                              <span className="text-rose-500">*</span>
                            </Label>
                            <Select
                              value={it.batch_id ? String(it.batch_id) : ""}
                              onValueChange={(v) => changeBatch(i, +v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih variasi" />
                              </SelectTrigger>
                              <SelectContent>
                                {matches.map((b) => (
                                  <SelectItem key={b.id} value={String(b.id)}>
                                    {b.grade?.name ?? "Belum disortir"}
                                    {b.size_cm
                                      ? ` · ${formatSize(b.size_cm, b.size_max_cm)}`
                                      : ""}
                                    {" · "}
                                    {formatNumber(b.current_count)} ekor
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Stok info */}
                        {selectedBatch && (
                          <div className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                            Stok tersedia:{" "}
                            <span className="font-mono font-semibold text-foreground">
                              {formatNumber(selectedBatch.current_count)} ekor
                            </span>
                            {selectedBatch.grade?.name && (
                              <> · Grade <span className="font-medium">{selectedBatch.grade.name}</span></>
                            )}
                          </div>
                        )}

                        {/* Ekor / Ukuran / Harga */}
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              Ekor <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              max={selectedBatch?.current_count}
                              value={it.count || ""}
                              onChange={(e) =>
                                patchItem(i, {
                                  count: e.target.value ? +e.target.value : 0,
                                })
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Ukuran (cm)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={200}
                              value={it.size_cm ?? ""}
                              onChange={(e) =>
                                patchItem(i, {
                                  size_cm: e.target.value
                                    ? +e.target.value
                                    : null,
                                })
                              }
                              placeholder={
                                selectedBatch?.size_cm
                                  ? String(selectedBatch.size_cm)
                                  : "—"
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              Harga / ekor <span className="text-rose-500">*</span>
                            </Label>
                            <PriceShortcutInput
                              value={it.price_per_fish}
                              onChange={(v) =>
                                patchItem(i, { price_per_fish: v })
                              }
                              placeholder="1.5 jt"
                            />
                          </div>
                        </div>

                        {lineSubtotal > 0 && (
                          <div className="mt-3 flex justify-end text-[12px] text-muted-foreground">
                            Subtotal:{" "}
                            <span className="ml-1 font-mono font-semibold text-foreground">
                              {formatRp(lineSubtotal)}
                            </span>
                          </div>
                        )}
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Diskon / Ongkir / Catatan + Total */}
            <GlassCard gradient="amber">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Diskon</Label>
                  <PriceShortcutInput
                    value={form.discount || null}
                    onChange={(v) => setForm({ ...form, discount: v ?? 0 })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ongkir</Label>
                  <PriceShortcutInput
                    value={form.shipping_cost || null}
                    onChange={(v) =>
                      setForm({ ...form, shipping_cost: v ?? 0 })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea
                    rows={1}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Opsional"
                  />
                </div>
              </div>
              <div className="space-y-1 border-t border-border/50 pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatRp(subtotal)}</span>
                </div>
                {form.discount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Diskon</span>
                    <span className="font-mono">−{formatRp(form.discount)}</span>
                  </div>
                )}
                {form.shipping_cost > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Ongkir</span>
                    <span className="font-mono">+{formatRp(form.shipping_cost)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border/50 pt-2 text-base">
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
                !itemsValid ||
                create.isPending
              }
              onClick={submit}
            >
              <ShoppingCart className="h-4 w-4" />
              Simpan Penjualan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Penjualan</DialogTitle>
            <DialogDescription>
              Ubah status atau catatan. Item & jumlah tidak bisa diubah —
              batalkan & buat ulang kalau perlu koreksi.
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
