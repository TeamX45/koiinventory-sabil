import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Skull, Calendar, MapPin, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import {
  MortalitiesApi,
  BatchesApi,
  PondsApi,
} from "@/api/endpoints";
import {
  PageHeader,
  DataTable,
  GlassCard,
  StatCard,
  Pagination,
  type Column,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatDate, formatNumber } from "@/utils/format";
import type { Mortality, PaginatedResponse } from "@/types/models";

const COMMON_CAUSES = [
  "Penyakit kulit",
  "Penyakit insang",
  "Stres pindah kolam",
  "Kualitas air buruk",
  "Predator",
  "Trauma fisik",
  "Tidak diketahui",
];

export default function MortalitiesPage() {
  const qc = useQueryClient();
  const { success, confirm, confirmDelete, dismissSuccess } = useFeedback();

  // Filters
  const [pondFilter, setPondFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);

  const params: Record<string, unknown> = { page };
  if (pondFilter !== "all") params.pond_id = pondFilter;
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading } = useQuery({
    queryKey: ["mortalities", { pondFilter, from, to, page }],
    queryFn: () => MortalitiesApi.list(params),
    placeholderData: (prev) => prev,
  });
  const mortalities = data?.data ?? [];
  const meta = data?.meta;

  const { data: summary } = useQuery({
    queryKey: ["mortalities-summary"],
    queryFn: MortalitiesApi.summary,
  });

  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });

  const { data: activeBatches } = useQuery({
    queryKey: ["batches", "active-all"],
    queryFn: () => BatchesApi.listAll({ status: "active" }),
  });

  // Form
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    batch_id: 0,
    mortality_date: new Date().toISOString().slice(0, 10),
    count: 0,
    cause: "",
    notes: "",
  });
  const selectedBatch = activeBatches?.find((b) => b.id === form.batch_id);

  const emptyForm = {
    batch_id: 0,
    mortality_date: new Date().toISOString().slice(0, 10),
    count: 0,
    cause: "",
    notes: "",
  };

  const [editing, setEditing] = useState<Mortality | null>(null);
  const [editForm, setEditForm] = useState({
    mortality_date: "",
    cause: "",
    notes: "",
  });

  const create = useMutation({
    mutationFn: MortalitiesApi.create,
    onMutate: (payload) => {
      if (page === 1) {
        const tempId = -Date.now();
        const batch = activeBatches?.find((b) => b.id === payload.batch_id);
        const optimistic = { id: tempId, batch, ...payload } as unknown as Mortality;
        qc.setQueryData<PaginatedResponse<Mortality>>(
          ["mortalities", { pondFilter, from, to, page: 1 }],
          (old) =>
            old
              ? { ...old, data: [optimistic, ...old.data], meta: { ...old.meta, total: old.meta.total + 1 } }
              : old,
        );
      } else {
        setPage(1);
      }
      success({
        title: "Kematian Dicatat",
        message: `${payload.count} ekor tercatat${payload.cause ? ` karena ${payload.cause}` : ""}. Stok batch sudah berkurang.`,
      });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal mencatat kematian."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["mortalities"] });
      qc.invalidateQueries({ queryKey: ["mortalities-summary"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: typeof editForm }) =>
      MortalitiesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      const key = ["mortalities", { pondFilter, from, to, page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Mortality>>(key);
      qc.setQueryData<PaginatedResponse<Mortality>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((m) =>
                m.id === vars.id ? ({ ...m, ...vars.payload } as Mortality) : m,
              ),
            }
          : old,
      );
      success({
        title: "Catatan Diperbarui",
        message: "Detail kematian berhasil disimpan.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui catatan."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["mortalities"] });
      qc.invalidateQueries({ queryKey: ["mortalities-summary"] });
    },
  });

  const remove = useMutation({
    mutationFn: MortalitiesApi.delete,
    onMutate: async (id) => {
      const key = ["mortalities", { pondFilter, from, to, page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Mortality>>(key);
      qc.setQueryData<PaginatedResponse<Mortality>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((m) => m.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      success({
        title: "Catatan Dihapus",
        message: "Stok batch otomatis dikembalikan.",
      });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus catatan."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["mortalities"] });
      qc.invalidateQueries({ queryKey: ["mortalities-summary"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  function openEdit(m: Mortality) {
    setEditing(m);
    setEditForm({
      mortality_date: m.mortality_date.slice(0, 10),
      cause: m.cause ?? "",
      notes: m.notes ?? "",
    });
  }

  async function handleDelete(m: Mortality) {
    const ok = await confirmDelete({
      title: `Hapus catatan kematian?`,
      description: `${m.count} ekor pada ${formatDate(m.mortality_date)} akan dihapus dan stok ${m.batch?.pond?.name ?? "batch"} dikembalikan.`,
      confirmLabel: "Ya, Hapus & Kembalikan Stok",
    });
    if (ok) remove.mutate(m.id);
  }

  async function handleSubmit() {
    const ok = await confirm({
      title: "Konfirmasi Catatan Kematian",
      description: `Anda akan mencatat ${form.count} ekor mati. Stok batch akan berkurang dan tidak bisa dibatalkan. Lanjutkan?`,
      confirmLabel: "Ya, Catat",
      variant: "destructive",
    });
    if (!ok) return;
    const payload = form;
    setOpen(false);
    setForm(emptyForm);
    create.mutate(payload);
  }

  const columns: Column<Mortality>[] = [
    {
      key: "mortality_date",
      header: "Tanggal",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(row.mortality_date)}
        </span>
      ),
    },
    {
      key: "pond",
      header: "Kolam",
      cell: (row) => (
        <div className="text-[12px]">
          <div className="font-medium">{row.batch?.pond?.name}</div>
          {row.batch?.pond?.location?.name && (
            <div className="text-muted-foreground/70">
              {row.batch.pond.location.name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "grade",
      header: "Grade",
      cell: (row) =>
        row.batch?.grade ? (
          <Badge variant="outline">{row.batch.grade.name}</Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-amber-300 text-amber-700 dark:text-amber-400"
          >
            unsorted
          </Badge>
        ),
    },
    {
      key: "count",
      header: "Ekor Mati",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right font-mono font-semibold text-rose-600 dark:text-rose-400",
      cell: (row) => `−${formatNumber(row.count)}`,
    },
    {
      key: "cause",
      header: "Penyebab",
      cell: (row) =>
        row.cause ? (
          <span className="inline-flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 text-rose-500" />
            <span className="text-[12px]">{row.cause}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/60 text-[12px]">—</span>
        ),
    },
    {
      key: "notes",
      header: "Catatan",
      cell: (row) => (
        <span className="text-[12px] text-muted-foreground line-clamp-1">
          {row.notes ?? "—"}
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
        title="Ikan Mati"
        description="Catatan kematian ikan untuk audit & analisis penyebab"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Catat Kematian
          </Button>
        }
      />

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Bulan Ini"
            value={`${formatNumber(summary.total_this_month)} ekor`}
            subtitle="Sejak awal bulan"
            icon={<Skull className="h-6 w-6" />}
            color="rose"
          />
          <StatCard
            title="Minggu Ini"
            value={`${formatNumber(summary.total_this_week)} ekor`}
            subtitle="Sejak awal minggu"
            icon={<Skull className="h-6 w-6" />}
            color="amber"
          />
          <StatCard
            title="Total Sepanjang Waktu"
            value={`${formatNumber(summary.total_all_time)} ekor`}
            subtitle="Akumulasi semua"
            icon={<Skull className="h-6 w-6" />}
            color="violet"
          />
        </div>
      )}

      {/* Trend chart + breakdowns */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2" gradient="rose">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Tren 14 Hari Terakhir</h2>
              <p className="text-[12px] text-muted-foreground">
                Jumlah ekor mati per hari
              </p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.trend_14_days}>
                  <defs>
                    <linearGradient id="mortality-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 0.06)" />
                  <XAxis
                    dataKey="date"
                    stroke="currentColor"
                    fontSize={11}
                    className="text-muted-foreground"
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                      })
                    }
                  />
                  <YAxis
                    stroke="currentColor"
                    fontSize={11}
                    allowDecimals={false}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                    }}
                    labelFormatter={(v) =>
                      new Date(v).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fill="url(#mortality-gradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard gradient="amber">
            <h2 className="text-base font-semibold mb-4">Top Penyebab (Bulan Ini)</h2>
            {summary.top_causes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada kematian bulan ini.
              </p>
            ) : (
              <ul className="space-y-2">
                {summary.top_causes.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/10 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        {i + 1}
                      </span>
                      {c.cause}
                    </span>
                    <span className="font-mono font-semibold">
                      {formatNumber(c.total)} ekor
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      )}

      {/* Filters */}
      <GlassCard variant="subtle" className="!py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label className="text-[11px]">Kolam</Label>
            <Select value={pondFilter} onValueChange={setPondFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kolam</SelectItem>
                {ponds?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Dari Tanggal</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="sm:w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Sampai Tanggal</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="sm:w-40"
            />
          </div>
          {(from || to || pondFilter !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom("");
                setTo("");
                setPondFilter("all");
              }}
            >
              Reset filter
            </Button>
          )}
        </div>
      </GlassCard>

      {/* List */}
      <DataTable
        data={mortalities}
        columns={columns}
        keyExtractor={(m) => String(m.id)}
        isLoading={isLoading && !data}
        searchKey="cause"
        searchPlaceholder="Cari penyebab..."
        emptyMessage="Belum ada kematian tercatat."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      {/* Form modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Catat Kematian Ikan</DialogTitle>
            <DialogDescription>
              Stok batch otomatis berkurang & audit trail tercatat
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Batch <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={String(form.batch_id || "")}
                onValueChange={(v) =>
                  setForm({ ...form, batch_id: +v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih batch ikan" />
                </SelectTrigger>
                <SelectContent>
                  {activeBatches?.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.pond?.name ?? "Batch"} •{" "}
                      {formatNumber(b.current_count)} ekor
                      {b.grade ? ` • ${b.grade.name}` : " • unsorted"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBatch && (
                <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {selectedBatch.pond?.name} • Stok saat ini:{" "}
                  <span className="font-mono font-semibold">
                    {formatNumber(selectedBatch.current_count)}
                  </span>{" "}
                  ekor
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Tanggal <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.mortality_date}
                  onChange={(e) =>
                    setForm({ ...form, mortality_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Jumlah Ekor <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={selectedBatch?.current_count}
                  value={form.count || ""}
                  onChange={(e) =>
                    setForm({ ...form, count: +e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Penyebab</Label>
              <Select
                value={form.cause}
                onValueChange={(v) => setForm({ ...form, cause: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih atau ketik manual di catatan" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CAUSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detail penyebab atau observasi tambahan"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={
                !form.batch_id ||
                !form.count ||
                form.count > (selectedBatch?.current_count ?? 0)
              }
              onClick={handleSubmit}
            >
              Catat Kematian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Catatan Kematian</DialogTitle>
            <DialogDescription>
              Tanggal, penyebab, dan catatan dapat diubah. Jumlah ekor & batch tidak bisa
              diubah — hapus & catat ulang jika perlu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={editForm.mortality_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, mortality_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Penyebab</Label>
              <Select
                value={editForm.cause}
                onValueChange={(v) => setEditForm({ ...editForm, cause: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih penyebab" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CAUSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
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
