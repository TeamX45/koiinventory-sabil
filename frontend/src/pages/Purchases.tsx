import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PackageCheck, Pencil, Trash2, X, History } from "lucide-react";
import {
  PurchasesApi,
  SuppliersApi,
  PondsApi,
  MasterApi,
  type PurchaseAllocation,
} from "@/api/endpoints";
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

/**
 * Satu baris pemecahan saat terima barang: berapa ekor masuk ke kolam mana,
 * ikan apa, ukuran berapa. Borongan jarang masuk ke satu kolam.
 */
interface AllocationRow {
  key: string;
  pond_id: number;
  count: number | null;
  fish_type_id: number | null;
  grade_id: number | null;
  size_cm: number | null;
  size_max_cm: number | null;
  /** Estimasi harga jual per ekor. Diisi = ikan langsung siap jual. */
  price_per_fish: number | null;
}

let allocSeq = 0;

const emptyAllocation = (count: number | null = null): AllocationRow => ({
  key: `alok-${++allocSeq}`,
  pond_id: 0,
  count,
  fish_type_id: null,
  grade_id: null,
  size_cm: null,
  size_max_cm: null,
  price_per_fish: null,
});

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
  const { data: fishTypes = [] } = useQuery({
    queryKey: ["fish-types"],
    queryFn: MasterApi.fishTypes,
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: MasterApi.grades,
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
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);

  const receiving = purchases.find((p) => p.id === openReceive) ?? null;
  const allocated = allocations.reduce((sum, a) => sum + (a.count ?? 0), 0);
  const target = Number(receiving?.total_count ?? 0);
  const sisa = target - allocated;

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

  function patchAllocation(idx: number, patch: Partial<AllocationRow>) {
    setAllocations((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  /**
   * Satu kolam sering diisi beberapa jenis sekaligus (5 ekor = 1 asagi,
   * 2 kohaku, 2 cagoi). Baris baru disisipkan tepat di bawahnya dengan kolam
   * yang sama supaya urutannya tetap terbaca sebagai satu kelompok.
   */
  function addTypeToSamePond(idx: number) {
    setAllocations((rs) => [
      ...rs.slice(0, idx + 1),
      { ...emptyAllocation(null), pond_id: rs[idx].pond_id },
      ...rs.slice(idx + 1),
    ]);
  }

  // Harga beli per ekor tidak perlu diketik: sudah bisa dihitung dari PO.
  // Ditampilkan sebagai pembanding saat mengisi estimasi harga jual.
  const modalPerEkor =
    receiving && Number(receiving.total_count) > 0
      ? Number(receiving.subtotal) / Number(receiving.total_count)
      : null;

  const perPond = useMemo(() => {
    const map = new Map<number, { name: string; count: number; rows: number }>();

    allocations.forEach((a) => {
      if (!a.pond_id) return;
      const name = ponds?.find((p) => p.id === a.pond_id)?.name ?? `Kolam #${a.pond_id}`;
      const current = map.get(a.pond_id) ?? { name, count: 0, rows: 0 };
      current.count += a.count ?? 0;
      current.rows += 1;
      map.set(a.pond_id, current);
    });

    return [...map.values()];
  }, [allocations, ponds]);

  const receive = useMutation({
    mutationFn: ({ id, allocations }: { id: number; allocations: PurchaseAllocation[] }) =>
      PurchasesApi.receive(id, { allocations }),
    onMutate: async ({ id, allocations: rows }) => {
      const jumlahKolam = new Set(rows.map((r) => r.pond_id)).size;
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
        message:
          jumlahKolam > 1
            ? `Ikan dibagi ke ${jumlahKolam} kolam dan stoknya langsung bertambah.`
            : "Ikan masuk ke kolam dan stoknya langsung bertambah.",
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
      // Terima barang membuat batch baru di kolam staging: isi kolam dan
      // total stok di beranda ikut berubah.
      qc.invalidateQueries({ queryKey: ["ponds"] });
      qc.invalidateQueries({ queryKey: ["pond-batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
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
                onClick={() => {
                  // Baris pertama sudah berisi seluruh ekor: kalau memang masuk
                  // satu kolam, tinggal pilih kolamnya lalu simpan.
                  setAllocations([emptyAllocation(Number(row.total_count) || 0)]);
                  setOpenReceive(row.id);
                }}
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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/purchases/history">
                <History className="h-4 w-4" />
                Riwayat
              </Link>
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Buat PO
            </Button>
          </div>
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
        onOpenChange={(o) => {
          if (!o) {
            setOpenReceive(null);
            setAllocations([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Terima Pembelian</DialogTitle>
            <DialogDescription>
              {receiving
                ? `${receiving.code} - ${formatNumber(receiving.total_count)} ekor. Bagi ke satu atau beberapa kolam; satu kolam boleh diisi beberapa jenis. Grade + harga jual diisi sekarang = langsung siap jual, kalau dikosongkan ditentukan nanti lewat Sortir.`
                : "Bagi isi PO ke kolam tujuan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {allocations.map((a, idx) => (
              <div
                key={a.key}
                className="rounded-lg border border-border/50 bg-muted/20 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {ponds?.find((p) => p.id === a.pond_id)?.name ?? `Bagian ${idx + 1}`}
                  </span>
                  <div className="flex items-center gap-3">
                    {a.pond_id > 0 && (
                      <button
                        type="button"
                        onClick={() => addTypeToSamePond(idx)}
                        className="text-[11px] font-medium text-violet-600 transition-colors hover:underline dark:text-violet-400"
                      >
                        + jenis lain di kolam ini
                      </button>
                    )}
                    {allocations.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setAllocations((rs) => rs.filter((_, i) => i !== idx))
                        }
                        title="Hapus bagian ini"
                        className="text-muted-foreground transition-colors hover:text-rose-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="col-span-2 space-y-1 sm:col-span-1">
                    <Label className="text-[11px]">
                      Kolam <span className="text-rose-500">*</span>
                    </Label>
                    <Select
                      value={a.pond_id ? String(a.pond_id) : ""}
                      onValueChange={(v) => patchAllocation(idx, { pond_id: +v })}
                    >
                      <SelectTrigger className="h-9">
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

                  <div className="space-y-1">
                    <Label className="text-[11px]">
                      Jumlah (ekor) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      className="h-9 text-right font-mono"
                      type="number"
                      min={1}
                      value={a.count ?? ""}
                      onChange={(e) =>
                        patchAllocation(idx, {
                          count:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Jenis ikan</Label>
                    <Select
                      value={a.fish_type_id ? String(a.fish_type_id) : ""}
                      onValueChange={(v) =>
                        patchAllocation(idx, { fish_type_id: +v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Opsional" />
                      </SelectTrigger>
                      <SelectContent>
                        {fishTypes.map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.full_name ?? f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Grade</Label>
                    <Select
                      value={a.grade_id ? String(a.grade_id) : ""}
                      onValueChange={(v) => patchAllocation(idx, { grade_id: +v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Opsional" />
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

                  <div className="col-span-2 space-y-1">
                    <Label className="text-[11px]">
                      Estimasi harga jual / ekor
                    </Label>
                    <Input
                      className="h-9 text-right font-mono"
                      type="number"
                      min={0}
                      placeholder={
                        modalPerEkor
                          ? `opsional - modal ${formatRp(modalPerEkor)}`
                          : "opsional"
                      }
                      value={a.price_per_fish ?? ""}
                      onChange={(e) =>
                        patchAllocation(idx, {
                          price_per_fish:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <Label className="text-[11px]">Ukuran (cm)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-9 text-right font-mono"
                        type="number"
                        min={1}
                        placeholder="dari"
                        value={a.size_cm ?? ""}
                        onChange={(e) =>
                          patchAllocation(idx, {
                            size_cm:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                      <span className="text-[12px] text-muted-foreground">s/d</span>
                      <Input
                        className="h-9 text-right font-mono"
                        type="number"
                        min={1}
                        placeholder="sampai"
                        value={a.size_max_cm ?? ""}
                        onChange={(e) =>
                          patchAllocation(idx, {
                            size_max_cm:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setAllocations((rs) => [
                  ...rs,
                  emptyAllocation(sisa > 0 ? sisa : null),
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Tambah kolam
            </Button>

            <div
              className={
                "rounded-lg border p-3 text-[13px] " +
                (sisa === 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400")
              }
            >
              Dialokasikan <strong>{formatNumber(allocated)}</strong> dari{" "}
              <strong>{formatNumber(target)}</strong> ekor
              {sisa > 0 && ` - sisa ${formatNumber(sisa)} ekor belum punya kolam`}
              {sisa < 0 && ` - kelebihan ${formatNumber(-sisa)} ekor`}

              {perPond.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-current/20 pt-2 text-[12px] opacity-90">
                  {perPond.map((k) => (
                    <span key={k.name}>
                      {k.name}: <strong>{formatNumber(k.count)}</strong> ekor
                      {k.rows > 1 && ` (${k.rows} jenis)`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenReceive(null);
                setAllocations([]);
              }}
            >
              Batal
            </Button>
            <Button
              disabled={
                sisa !== 0 ||
                allocations.length === 0 ||
                allocations.some((a) => !a.pond_id || !a.count) ||
                receive.isPending
              }
              onClick={() => {
                const id = openReceive!;
                const payload: PurchaseAllocation[] = allocations.map((a) => ({
                  pond_id: a.pond_id,
                  count: a.count!,
                  fish_type_id: a.fish_type_id,
                  grade_id: a.grade_id,
                  size_cm: a.size_cm,
                  size_max_cm: a.size_max_cm,
                  price_per_fish: a.price_per_fish,
                }));
                setOpenReceive(null);
                setAllocations([]);
                receive.mutate({ id, allocations: payload });
              }}
            >
              <PackageCheck className="h-4 w-4" />
              Terima{" "}
              {allocations.length > 1 ? `ke ${allocations.length} Kolam` : "Barang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
