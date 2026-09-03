import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PurchasesApi, SuppliersApi, fetchAllPages } from "@/api/endpoints";
import { ReportLayout, ReportStat } from "@/components/common/report-layout";
import { GlassCard, LoadingState } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatNumber, formatRp } from "@/utils/format";
import type { Purchase } from "@/types/models";

const awalBulan = () => {
  const d = new Date();

  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const STATUS = ["pending", "received", "sorted", "cancelled"] as const;

export default function PurchaseHistoryPage() {
  const [from, setFrom] = useState(awalBulan);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>("all");
  const [supplierId, setSupplierId] = useState<string>("all");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: SuppliersApi.list,
  });

  const params = {
    from,
    to,
    ...(status !== "all" ? { status } : {}),
    ...(supplierId !== "all" ? { supplier_id: Number(supplierId) } : {}),
  };

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases-history", params],
    queryFn: () =>
      fetchAllPages<Purchase>((page) =>
        PurchasesApi.list({ ...params, page, per_page: 100 }),
      ),
    enabled: !!from && !!to,
  });

  const total = useMemo(() => {
    const aktif = purchases.filter((p) => p.status !== "cancelled");
    const ekor = aktif.reduce((n, p) => n + Number(p.total_count ?? 0), 0);
    const rupiah = aktif.reduce((n, p) => n + Number(p.subtotal ?? 0), 0);

    return {
      po: aktif.length,
      dibatalkan: purchases.length - aktif.length,
      belumDiterima: aktif.filter((p) => p.status === "pending").length,
      ekor,
      rupiah,
      rata: ekor > 0 ? rupiah / ekor : 0,
    };
  }, [purchases]);

  return (
    <ReportLayout
      title="Riwayat Pembelian"
      periodFrom={from}
      periodTo={to}
      backTo="/purchases"
      backLabel="Kembali ke Pembelian"
      filters={
        <GlassCard>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[12px]">Dari tanggal</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px]">Sampai tanggal</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px]">Pemasok</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua pemasok</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[12px]">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </GlassCard>
      }
      summary={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <ReportStat label="Jumlah PO" value={formatNumber(total.po)} />
          <ReportStat label="Ekor dibeli" value={formatNumber(total.ekor)} />
          <ReportStat label="Total belanja" value={formatRp(total.rupiah)} />
          <ReportStat label="Rata-rata / ekor" value={formatRp(total.rata)} />
          <ReportStat label="Belum diterima" value={formatNumber(total.belumDiterima)} />
        </div>
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : purchases.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-slate-500">
          Tidak ada pembelian pada periode ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2 pr-3 font-semibold">Tanggal</th>
                <th className="py-2 pr-3 font-semibold">Kode PO</th>
                <th className="py-2 pr-3 font-semibold">Pemasok</th>
                <th className="py-2 pr-3 text-right font-semibold">Ekor</th>
                <th className="py-2 pr-3 text-right font-semibold">Subtotal</th>
                <th className="py-2 pr-3 text-right font-semibold">Rata-rata / ekor</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const batal = p.status === "cancelled";
                const ekor = Number(p.total_count ?? 0);
                const rata = ekor > 0 ? Number(p.subtotal ?? 0) / ekor : 0;

                return (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-200 ${batal ? "text-slate-400 line-through" : ""}`}
                  >
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {formatDate(p.purchase_date)}
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{p.code}</td>
                    <td className="py-1.5 pr-3">{p.supplier?.name ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatNumber(ekor)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                      {formatRp(p.subtotal)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatRp(rata)}</td>
                    <td className="py-1.5">{p.status}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="py-2 pr-3" colSpan={3}>
                  Total ({formatNumber(total.po)} PO
                  {total.dibatalkan > 0 && `, ${total.dibatalkan} dibatalkan tidak dihitung`})
                </td>
                <td className="py-2 pr-3 text-right font-mono">{formatNumber(total.ekor)}</td>
                <td className="py-2 pr-3 text-right font-mono">{formatRp(total.rupiah)}</td>
                <td className="py-2 pr-3 text-right font-mono">{formatRp(total.rata)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </ReportLayout>
  );
}
