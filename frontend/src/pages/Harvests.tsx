import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PackageCheck, Pencil, Trash2 } from "lucide-react";
import { HarvestsApi, PondsApi } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
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
import { formatDate, formatNumber } from "@/utils/format";
import type { Harvest, PaginatedResponse } from "@/types/models";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  pending: "warning",
  harvested: "info",
  sorted: "success",
  cancelled: "danger",
};

export default function HarvestsPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["harvests", { page }],
    queryFn: () => HarvestsApi.list({ page }),
    placeholderData: (prev) => prev,
  });
  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });

  const harvests = data?.data ?? [];
  const meta = data?.meta;

  const tanahPonds = useMemo(
    () => (ponds ?? []).filter((p) => p.location?.type === "tanah"),
    [ponds]
  );

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Harvest | null>(null);
  const [openReceive, setOpenReceive] = useState<number | null>(null);
  const emptyForm = {
    source_pond_id: 0,
    harvest_date: new Date().toISOString().slice(0, 10),
    total_count: 0,
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [stagingPondId, setStagingPondId] = useState(0);

  const create = useMutation({
    mutationFn: HarvestsApi.create,
    onMutate: (payload) => {
      if (page === 1) {
        const tempId = -Date.now();
        const sourcePond = ponds?.find((p) => p.id === payload.source_pond_id);
        const optimistic = {
          id: tempId,
          code: "...",
          status: "pending",
          source_pond: sourcePond,
          ...payload,
        } as unknown as Harvest;
        qc.setQueryData<PaginatedResponse<Harvest>>(
          ["harvests", { page: 1 }],
          (old) =>
            old
              ? { ...old, data: [optimistic, ...old.data], meta: { ...old.meta, total: old.meta.total + 1 } }
              : old,
        );
      } else {
        setPage(1);
      }
      success({
        title: "Panen Tercatat",
        message: `Panen disimpan dengan ${payload.total_count} ekor dari kolam tanah.`,
      });
    },
    onError: (e) => {
      dismissSuccess();
      toast.error(extractApiError(e, "Gagal menyimpan."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["harvests"] }),
  });

  const receive = useMutation({
    mutationFn: ({
      id,
      staging_pond_id,
    }: {
      id: number;
      staging_pond_id: number;
    }) => HarvestsApi.receive(id, { staging_pond_id }),
    onMutate: async ({ id }) => {
      const key = ["harvests", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Harvest>>(key);
      qc.setQueryData<PaginatedResponse<Harvest>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((h) =>
                h.id === id ? ({ ...h, status: "harvested" } as Harvest) : h,
              ),
            }
          : old,
      );
      success({
        title: "Panen Diterima",
        message: "Ikan berhasil dipindahkan ke kolam staging dan siap untuk disortir.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal terima."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["harvests"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: typeof form }) =>
      HarvestsApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      const key = ["harvests", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Harvest>>(key);
      qc.setQueryData<PaginatedResponse<Harvest>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((h) =>
                h.id === vars.id ? ({ ...h, ...vars.payload } as Harvest) : h,
              ),
            }
          : old,
      );
      success({
        title: "Panen Diperbarui",
        message: "Perubahan panen berhasil disimpan.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui panen."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["harvests"] }),
  });

  const remove = useMutation({
    mutationFn: HarvestsApi.delete,
    onMutate: async (id) => {
      const key = ["harvests", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<Harvest>>(key);
      qc.setQueryData<PaginatedResponse<Harvest>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((h) => h.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      success({ title: "Panen Dihapus", message: "Catatan panen berhasil dihapus." });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus panen."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["harvests"] }),
  });

  function openCreateModal() {
    setEditing(null);
    setForm(emptyForm);
    setOpenCreate(true);
  }

  function openEdit(h: Harvest) {
    setEditing(h);
    setForm({
      source_pond_id: h.source_pond_id,
      harvest_date: h.harvest_date.slice(0, 10),
      total_count: h.total_count,
      notes: "",
    });
    setOpenCreate(true);
  }

  function submitCreateOrEdit() {
    const data = form;
    const isEditing = editing;
    setOpenCreate(false);
    setEditing(null);
    setForm(emptyForm);
    if (isEditing) update.mutate({ id: isEditing.id, payload: data });
    else create.mutate(data);
  }

  async function handleDelete(h: Harvest) {
    const ok = await confirmDelete({
      title: `Hapus catatan panen?`,
      description: `Panen tanggal ${formatDate(h.harvest_date)} (${h.total_count} ekor) akan dihapus permanen.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(h.id);
  }

  const columns: Column<Harvest>[] = [
    {
      key: "harvest_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="font-medium">{formatDate(row.harvest_date)}</span>
      ),
    },
    {
      key: "source_pond",
      header: "Kolam Sumber",
      cell: (row) => {
        const pond = ponds?.find((p) => p.id === row.source_pond_id);
        return (
          <div className="text-[12px]">
            <div className="font-medium">
              {pond?.name ?? `#${row.source_pond_id}`}
            </div>
            {pond?.location?.name && (
              <div className="text-muted-foreground/70">{pond.location.name}</div>
            )}
          </div>
        );
      },
    },
    {
      key: "total_count",
      header: "Ekor",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => formatNumber(row.total_count),
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
              >
                <PackageCheck className="h-3.5 w-3.5" />
                Terima
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => openEdit(row)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(row)} title="Hapus">
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
        title="Panen Kolam Tanah"
        description="Panen dari Ds. Keramat / Ds. Penican — alur lanjut sama dengan pembelian"
        actions={
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Catat Panen
          </Button>
        }
      />

      <DataTable
        data={harvests}
        columns={columns}
        keyExtractor={(h) => String(h.id)}
        isLoading={isLoading}
        emptyMessage="Belum ada panen."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Panen" : "Catat Panen Baru"}</DialogTitle>
            <DialogDescription>
              Panen dari kolam tanah yang sudah mencapai ukuran target
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Kolam Tanah Sumber <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={String(form.source_pond_id || "")}
                onValueChange={(v) =>
                  setForm({ ...form, source_pond_id: +v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kolam tanah" />
                </SelectTrigger>
                <SelectContent>
                  {tanahPonds.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} {p.location?.name && `— ${p.location.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Tanggal Panen <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.harvest_date}
                  onChange={(e) =>
                    setForm({ ...form, harvest_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Total Ekor <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.total_count || ""}
                  onChange={(e) =>
                    setForm({ ...form, total_count: +e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Batal
            </Button>
            <Button
              disabled={!form.source_pond_id || !form.total_count}
              onClick={submitCreateOrEdit}
            >
              {editing ? "Simpan Perubahan" : "Simpan"}
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
            <DialogTitle>Terima Panen</DialogTitle>
            <DialogDescription>
              Pilih kolam staging untuk menampung ikan sebelum sortir
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>
              Kolam Staging <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={String(stagingPondId || "")}
              onValueChange={(v) => setStagingPondId(+v)}
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
              disabled={!stagingPondId}
              onClick={() => {
                const id = openReceive!;
                const staging_pond_id = stagingPondId;
                setOpenReceive(null);
                setStagingPondId(0);
                receive.mutate({ id, staging_pond_id });
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
