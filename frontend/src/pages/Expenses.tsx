import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Wallet,
  Calendar,
  Filter,
} from "lucide-react";
import {
  ExpensesApi,
  ExpenseCategoriesApi,
  LocationsApi,
} from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import {
  PageHeader,
  DataTable,
  GlassCard,
  StatCard,
  Pagination,
  PriceShortcutInput,
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
import { formatRp, formatRpShort, formatDate } from "@/utils/format";
import type { Expense } from "@/types/models";

interface FormState {
  expense_date: string;
  expense_category_id: number;
  location_id: number | null;
  description: string;
  amount: number | null;
  paid_by: string;
  payment_method: string;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const emptyForm: FormState = {
  expense_date: today(),
  expense_category_id: 0,
  location_id: null,
  description: "",
  amount: null,
  paid_by: "",
  payment_method: "",
  notes: "",
};

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string>(firstOfMonth());
  const [to, setTo] = useState<string>(today());
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterLoc, setFilterLoc] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const params = useMemo(
    () => ({
      page,
      from: from || undefined,
      to: to || undefined,
      expense_category_id: filterCat === "all" ? undefined : Number(filterCat),
      location_id: filterLoc === "all" ? undefined : Number(filterLoc),
      q: search || undefined,
    }),
    [page, from, to, filterCat, filterLoc, search],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", params],
    queryFn: () => ExpensesApi.list(params),
    placeholderData: (prev) => prev,
  });
  const expenses = data?.data ?? [];
  const meta = data?.meta;
  const summary = data?.summary ?? { total_amount: 0, count: 0 };

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: ExpenseCategoriesApi.list,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: LocationsApi.list,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const create = useMutation({
    mutationFn: ExpensesApi.create,
    onSuccess: () => {
      success({
        title: "Pengeluaran Dicatat",
        message: "Transaksi pengeluaran tersimpan.",
      });
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menyimpan pengeluaran."));
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<FormState> }) =>
      ExpensesApi.update(vars.id, {
        ...vars.payload,
        amount:
          typeof vars.payload.amount === "number"
            ? vars.payload.amount
            : undefined,
      }),
    onSuccess: () => {
      success({
        title: "Pengeluaran Diperbarui",
        message: "Perubahan tersimpan.",
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal memperbarui pengeluaran."));
    },
  });

  const remove = useMutation({
    mutationFn: ExpensesApi.delete,
    onMutate: async (id) => {
      const previous = qc.getQueryData(["expenses", params]);
      qc.setQueryData(["expenses", params], (old: typeof data) =>
        old
          ? {
              ...old,
              data: old.data.filter((e) => e.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      success({
        title: "Pengeluaran Dihapus",
        message: "Catatan dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["expenses", params], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      expense_date: e.expense_date.slice(0, 10),
      expense_category_id: e.expense_category_id,
      location_id: e.location_id ?? null,
      description: e.description,
      amount: typeof e.amount === "string" ? Number(e.amount) : e.amount,
      paid_by: e.paid_by ?? "",
      payment_method: e.payment_method ?? "",
      notes: e.notes ?? "",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.expense_category_id || !form.amount || !form.description) {
      toast.error("Tanggal, kategori, deskripsi, dan jumlah wajib diisi.");
      return;
    }
    const isEditing = editing;
    if (isEditing) {
      update.mutate({ id: isEditing.id, payload: form });
    } else {
      create.mutate({
        expense_date: form.expense_date,
        expense_category_id: form.expense_category_id,
        location_id: form.location_id || undefined,
        description: form.description,
        amount: form.amount!,
        paid_by: form.paid_by || undefined,
        payment_method: form.payment_method || undefined,
        notes: form.notes || undefined,
      });
    }
  }

  async function handleDelete(e: Expense) {
    const ok = await confirmDelete({
      title: "Hapus pengeluaran?",
      description: `Catatan "${e.description}" sebesar ${formatRp(e.amount)} akan dihapus.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(e.id);
  }

  function resetFilters() {
    setFrom(firstOfMonth());
    setTo(today());
    setFilterCat("all");
    setFilterLoc("all");
    setSearch("");
    setPage(1);
  }

  const columns: Column<Expense>[] = [
    {
      key: "expense_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="font-medium">{formatDate(row.expense_date)}</span>
      ),
    },
    {
      key: "category",
      header: "Kategori",
      cell: (row) => (
        <Badge
          variant="outline"
          className="border-violet-300 text-violet-700 dark:text-violet-400 bg-violet-500/10"
        >
          {row.category?.name ?? "—"}
        </Badge>
      ),
    },
    {
      key: "description",
      header: "Deskripsi",
      cell: (row) => (
        <div className="text-[12px]">
          <div className="font-medium">{row.description}</div>
          {row.paid_by && (
            <div className="text-muted-foreground/70">
              dibayar oleh {row.paid_by}
              {row.payment_method ? ` · ${row.payment_method}` : ""}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "location",
      header: "Lokasi",
      cell: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {row.location?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Jumlah",
      headerClassName: "text-right",
      className: "text-right font-mono font-semibold",
      cell: (row) => (
        <span title={formatRp(row.amount)} className="text-rose-600 dark:text-rose-400">
          {formatRpShort(row.amount)}
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

  const activeCategories = categories.filter((c) => c.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengeluaran"
        description="Catat biaya operasional kolam — listrik, wifi, pakan, host live, dll"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Catat Pengeluaran
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Total (filter aktif)"
          value={formatRpShort(summary.total_amount)}
          subtitle={`${summary.count} transaksi · ${formatDate(from)} – ${formatDate(to)}`}
          icon={<Wallet className="h-6 w-6" />}
          color="rose"
        />
        <StatCard
          title="Rata-rata per Transaksi"
          value={
            summary.count > 0
              ? formatRpShort(summary.total_amount / summary.count)
              : "—"
          }
          subtitle="Nilai rata-rata pada filter aktif"
          icon={<Receipt className="h-6 w-6" />}
          color="amber"
        />
      </div>

      <GlassCard variant="subtle" className="!py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-1 space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Dari
            </Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="md:col-span-1 space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Sampai
            </Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="md:col-span-1 space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Kategori
            </Label>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger>
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Lokasi
            </Label>
            <Select value={filterLoc} onValueChange={setFilterLoc}>
              <SelectTrigger>
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua lokasi</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Cari
            </Label>
            <Input
              placeholder="Deskripsi/catatan/pembayar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <Button variant="outline" onClick={resetFilters} className="w-full">
              <Filter className="h-4 w-4" />
              Reset Filter
            </Button>
          </div>
        </div>
      </GlassCard>

      <DataTable
        data={expenses}
        columns={columns}
        keyExtractor={(e) => String(e.id)}
        isLoading={isLoading}
        emptyMessage="Belum ada pengeluaran pada filter ini."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.code}` : "Catat Pengeluaran"}
            </DialogTitle>
            <DialogDescription>
              Input biaya operasional. Pakai input cepat untuk nominal: <code>1.5 jt</code>, <code>350 rb</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Tanggal <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) =>
                    setForm({ ...form, expense_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Kategori <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={
                    form.expense_category_id
                      ? String(form.expense_category_id)
                      : ""
                  }
                  onValueChange={(v) =>
                    setForm({ ...form, expense_category_id: +v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Deskripsi <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="mis. Token PLN 100rb, Beli pakan 2 sak"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Jumlah <span className="text-rose-500">*</span>
                </Label>
                <PriceShortcutInput
                  value={form.amount}
                  onChange={(v) => setForm({ ...form, amount: v })}
                  placeholder="1.5 jt / 350 rb / angka penuh"
                />
              </div>
              <div className="space-y-2">
                <Label>Lokasi (opsional)</Label>
                <Select
                  value={form.location_id ? String(form.location_id) : "none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      location_id: v === "none" ? null : +v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak terikat lokasi</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dibayar oleh</Label>
                <Input
                  value={form.paid_by}
                  onChange={(e) =>
                    setForm({ ...form, paid_by: e.target.value })
                  }
                  placeholder="mis. Pak Asep"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Metode bayar</Label>
                <Select
                  value={form.payment_method || "none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      payment_method: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer Bank</SelectItem>
                    <SelectItem value="qris">QRIS</SelectItem>
                    <SelectItem value="ewallet">E-Wallet</SelectItem>
                    <SelectItem value="other">Lain-lain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                rows={2}
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
            <Button
              disabled={
                !form.expense_date ||
                !form.expense_category_id ||
                !form.description ||
                !form.amount ||
                create.isPending ||
                update.isPending
              }
              onClick={submit}
            >
              <Calendar className="h-4 w-4" />
              {editing ? "Simpan Perubahan" : "Catat Pengeluaran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
