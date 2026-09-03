import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SalesApi, fetchAllPages } from "@/api/endpoints";
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
import type { Sale } from "@/types/models";

const awalBulan = () => {
  const d = new Date();

  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const STATUS = ["draft", "paid", "shipped", "completed", "cancelled"] as const;

export default function SalesHistoryPage() {
  const [from, setFrom] = useState(awalBulan);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>("all");

  const params = {
    from,
    to,
    ...(status !== "all" ? { status } : {}),
  };

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-history", params],
    queryFn: () =>
      fetchAllPages<Sale>((page) => SalesApi.list({ ...params, page, per_page: 100 })),
    enabled: !!from && !!to,
  });

  const total = useMemo(() => {
    // Penjualan batal tidak dihitung sebagai omzet, tapi tetap ditampilkan
    // barisnya supaya riwayatnya utuh.
    const aktif = sales.filter((s) => s.status !== "cancelled");

    return {
      transaksi: aktif.length,
      dibatalkan: sales.length - aktif.length,
      ekor: aktif.reduce(
        (n, s) => n + (s.items ?? []).reduce((m, i) => m + Number(i.count ?? 0), 0),
        0,
      ),
      omzet: aktif.reduce((n, s) => n + Number(s.total ?? 0), 0),
      diskon: aktif.reduce((n, s) => n + Number(s.discount ?? 0), 0),
      ongkir: aktif.reduce((n, s) => n + Number(s.shipping_cost ?? 0), 0),
    };
  }, [sales]);

  return (
    <ReportLayout
      title="Riwayat Penjualan"
      periodFrom={from}
      periodTo={to}
      backTo="/sales"
      backLabel="Kembali ke Penjualan"
      filters={
        <GlassCard>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-[12px]">Dari tanggal</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px]">Sampai tanggal</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
          <ReportStat label="Transaksi" value={formatNumber(total.transaksi)} />
          <ReportStat label="Ekor terjual" value={formatNumber(total.ekor)} />
          <ReportStat label="Omzet" value={formatRp(total.omzet)} />
          <ReportStat label="Diskon" value={formatRp(total.diskon)} />
          <ReportStat label="Ongkir" value={formatRp(total.ongkir)} />
        </div>
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : sales.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-slate-500">
          Tidak ada penjualan pada periode ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2 pr-3 font-semibold">Tanggal</th>
                <th className="py-2 pr-3 font-semibold">Kode</th>
                <th className="py-2 pr-3 font-semibold">Saluran</th>
                <th className="py-2 pr-3 font-semibold">Pelanggan</th>
                <th className="py-2 pr-3 text-right font-semibold">Ekor</th>
                <th className="py-2 pr-3 text-right font-semibold">Subtotal</th>
                <th className="py-2 pr-3 text-right font-semibold">Diskon</th>
                <th className="py-2 pr-3 text-right font-semibold">Ongkir</th>
                <th className="py-2 pr-3 text-right font-semibold">Total</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const ekor = (s.items ?? []).reduce((m, i) => m + Number(i.count ?? 0), 0);
                const batal = s.status === "cancelled";

                return (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-200 ${batal ? "text-slate-400 line-through" : ""}`}
                  >
                    <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(s.sale_date)}</td>
                    <td className="py-1.5 pr-3 font-mono">{s.code}</td>
                    <td className="py-1.5 pr-3">{s.channel?.name ?? "—"}</td>
                    <td className="py-1.5 pr-3">{s.customer_name ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatNumber(ekor)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatRp(s.subtotal)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatRp(s.discount)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {formatRp(s.shipping_cost)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                      {formatRp(s.total)}
                    </td>
                    <td className="py-1.5">{s.status}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="py-2 pr-3" colSpan={4}>
                  Total ({formatNumber(total.transaksi)} transaksi
                  {total.dibatalkan > 0 && `, ${total.dibatalkan} dibatalkan tidak dihitung`})
                </td>
                <td className="py-2 pr-3 text-right font-mono">{formatNumber(total.ekor)}</td>
                <td className="py-2 pr-3" colSpan={3} />
                <td className="py-2 pr-3 text-right font-mono">{formatRp(total.omzet)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </ReportLayout>
  );
}
