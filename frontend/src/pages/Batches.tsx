import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, Skull } from "lucide-react";
import { useFeedback } from "@/contexts/feedback-context";
import { BatchesApi, PondsApi } from "@/api/endpoints";
import { api } from "@/api/client";
import {
  PageHeader,
  DataTable,
  StatusBadge,
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
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatRp, formatDate, formatNumber } from "@/utils/format";
import type { Batch } from "@/types/models";

export default function BatchesPage() {
  const qc = useQueryClient();
  const { success, confirm } = useFeedback();
  const [filter, setFilter] = useState<"active" | "unsorted" | "depleted">(
    "active"
  );
  const [page, setPage] = useState(1);
  const params = filter === "unsorted" ? { unsorted: 1, page } : { status: filter, page };

  const { data, isLoading } = useQuery({
    queryKey: ["batches", { filter, page }],
    queryFn: () => BatchesApi.list(params),
    placeholderData: (prev) => prev,
  });
  const batches = data?.data ?? [];
  const meta = data?.meta;
  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });

  const [transferOf, setTransferOf] = useState<Batch | null>(null);
  const [transfer, setTransfer] = useState({
    to_pond_id: 0,
    count: 0,
    notes: "",
  });
  const [mortalityOf, setMortalityOf] = useState<Batch | null>(null);
  const [mortality, setMortality] = useState({ count: 0, cause: "", notes: "" });

  const doTransfer = useMutation({
    mutationFn: (vars: { batchId: number; payload: typeof transfer }) =>
      BatchesApi.transfer(vars.batchId, vars.payload),
    onMutate: (vars) => {
      const batchCode = batches.find((b) => b.id === vars.batchId)?.code;
      success({
        title: "Batch Dipindahkan",
        message: `${batchCode ?? "Batch"} berhasil dipindahkan ke kolam tujuan.`,
      });
    },
    onError: () => toast.error("Transfer gagal."),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["ponds"] });
    },
  });

  const doMortality = useMutation({
    mutationFn: (vars: {
      batchId: number;
      payload: typeof mortality;
    }) =>
      api.post("/v1/mortalities", {
        batch_id: vars.batchId,
        mortality_date: new Date().toISOString().slice(0, 10),
        ...vars.payload,
      }),
    onMutate: (vars) => {
      success({
        title: "Kematian Dicatat",
        message: `${vars.payload.count} ekor mati tercatat. Stok batch sudah berkurang.`,
      });
    },
    onError: () => toast.error("Gagal mencatat."),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["mortalities"] });
      qc.invalidateQueries({ queryKey: ["mortalities-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  async function submitTransfer() {
    const ok = await confirm({
      title: "Konfirmasi Transfer Batch",
      description: `Pindahkan ${transfer.count} ekor dari ${transferOf?.pond?.name} ke kolam tujuan?`,
      confirmLabel: "Ya, Pindahkan",
    });
    if (!ok) return;
    const batchId = transferOf!.id;
    const payload = transfer;
    setTransferOf(null);
    setTransfer({ to_pond_id: 0, count: 0, notes: "" });
    doTransfer.mutate({ batchId, payload });
  }

  async function submitMortality() {
    const ok = await confirm({
      title: "Konfirmasi Catatan Kematian",
      description: `Catat ${mortality.count} ekor mati dari ${mortalityOf?.pond?.name ?? "batch"}? Stok akan berkurang permanen.`,
      confirmLabel: "Ya, Catat",
      variant: "destructive",
    });
    if (!ok) return;
    const batchId = mortalityOf!.id;
    const payload = mortality;
    setMortalityOf(null);
    setMortality({ count: 0, cause: "", notes: "" });
    doMortality.mutate({ batchId, payload });
  }

  const columns: Column<Batch>[] = [
    {
      key: "source_type",
      header: "Sumber",
      cell: (row) => (
        <Badge
          variant={
            row.source_type === "sorting"
              ? "secondary"
              : row.source_type === "purchase"
              ? "default"
              : "outline"
          }
        >
          {row.source_type}
        </Badge>
      ),
    },
    {
      key: "pond",
      header: "Kolam",
      cell: (row) => (
        <div className="text-[12px]">
          <div className="font-medium">{row.pond?.name}</div>
          {row.pond?.location?.name && (
            <div className="text-muted-foreground/70">{row.pond.location.name}</div>
          )}
        </div>
      ),
    },
    {
      key: "grade",
      header: "Grade",
      cell: (row) =>
        row.grade ? (
          <Badge
            variant="outline"
            className={
              row.grade.rank === 1
                ? "border-amber-300 text-amber-700 dark:text-amber-400"
                : row.grade.rank === 2
                ? "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                : "border-violet-300 text-violet-700 dark:text-violet-400"
            }
          >
            {row.grade.name}
          </Badge>
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
      key: "current_count",
      header: "Stok",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => (
        <>
          <span>{formatNumber(row.current_count)}</span>
          <span className="text-muted-foreground/60">
            {" "}
            / {formatNumber(row.initial_count)}
          </span>
        </>
      ),
    },
    {
      key: "price_per_fish",
      header: "Harga/ekor",
      headerClassName: "text-right",
      className: "text-right font-mono",
      cell: (row) => formatRp(row.price_per_fish),
    },
    {
      key: "entry_date",
      header: "Tanggal",
      cell: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDate(row.entry_date)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      cell: (row) =>
        row.status === "active" ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setTransferOf(row);
                setTransfer({
                  to_pond_id: 0,
                  count: row.current_count,
                  notes: "",
                });
              }}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Transfer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMortalityOf(row)}
            >
              <Skull className="h-3.5 w-3.5" />
              Mati
            </Button>
          </div>
        ) : (
          <StatusBadge status={row.status} />
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Ikan"
        description="Kelompok ikan per kolam — sumber stok untuk penjualan"
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="active">Aktif</TabsTrigger>
          <TabsTrigger value="unsorted">Belum Disortir</TabsTrigger>
          <TabsTrigger value="depleted">Habis</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        data={batches}
        columns={columns}
        keyExtractor={(b) => String(b.id)}
        isLoading={isLoading}
        emptyMessage="Tidak ada batch."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      <Dialog
        open={!!transferOf}
        onOpenChange={(o) => !o && setTransferOf(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Batch dari {transferOf?.pond?.name ?? "Kolam"}</DialogTitle>
            <DialogDescription>
              Stok saat ini: {formatNumber(transferOf?.current_count ?? 0)} ekor
              di {transferOf?.pond?.name ?? ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Kolam Tujuan <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={String(transfer.to_pond_id || "")}
                onValueChange={(v) =>
                  setTransfer({ ...transfer, to_pond_id: +v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kolam" />
                </SelectTrigger>
                <SelectContent>
                  {ponds
                    ?.filter((p) => p.id !== transferOf?.pond_id)
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.code} — {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Jumlah Ekor <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="number"
                max={transferOf?.current_count}
                value={transfer.count}
                onChange={(e) =>
                  setTransfer({ ...transfer, count: +e.target.value })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Maks {formatNumber(transferOf?.current_count ?? 0)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={transfer.notes}
                onChange={(e) =>
                  setTransfer({ ...transfer, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOf(null)}>
              Batal
            </Button>
            <Button
              disabled={!transfer.to_pond_id || !transfer.count}
              onClick={submitTransfer}
            >
              Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!mortalityOf}
        onOpenChange={(o) => !o && setMortalityOf(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Kematian — {mortalityOf?.pond?.name ?? "Batch"}</DialogTitle>
            <DialogDescription>
              Stok {formatNumber(mortalityOf?.current_count ?? 0)} ekor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Jumlah Ekor Mati <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="number"
                max={mortalityOf?.current_count}
                value={mortality.count}
                onChange={(e) =>
                  setMortality({ ...mortality, count: +e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Penyebab</Label>
              <Input
                value={mortality.cause}
                onChange={(e) =>
                  setMortality({ ...mortality, cause: e.target.value })
                }
                placeholder="mis. penyakit kulit, stres pindah"
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={mortality.notes}
                onChange={(e) =>
                  setMortality({ ...mortality, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMortalityOf(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={!mortality.count}
              onClick={submitMortality}
            >
              Catat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
