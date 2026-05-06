import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import { SalesApi } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/brand";
import { formatRp, formatDate, formatNumber, formatSize } from "@/utils/format";

/**
 * Halaman struk penjualan — print-friendly.
 * Tombol "Cetak" memicu window.print(); CSS @media print menyembunyikan
 * tombol/sidebar dan menyusun layout untuk thermal/A4.
 */
export default function SaleReceiptPage() {
  const { id } = useParams();
  const saleId = Number(id);

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => SalesApi.get(saleId),
    enabled: !!saleId,
  });

  // Title dokumen → jadi nama default file kalau "Save as PDF"
  useEffect(() => {
    if (sale) {
      document.title = `Struk ${sale.code} — ${brand.name}`;
    }
    return () => {
      document.title = brand.name;
    };
  }, [sale]);

  if (isLoading || !sale) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const subtotal = Number(sale.subtotal);
  const discount = Number(sale.discount ?? 0);
  const shipping = Number(sale.shipping_cost ?? 0);
  const total = Number(sale.total);

  return (
    <>
      {/* Print stylesheet */}
      <style>{`
        @media print {
          @page { size: A5 portrait; margin: 12mm; }
          body * { visibility: hidden !important; }
          .receipt, .receipt * { visibility: visible !important; }
          .receipt { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          aside, header, nav, .sidebar { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          to="/sales"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar penjualan
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Cetak / Simpan PDF
        </Button>
      </div>

      <div className="receipt mx-auto max-w-2xl rounded-lg border border-border bg-white p-8 text-black shadow-sm dark:bg-white dark:text-black">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between border-b border-gray-300 pb-4">
          <div>
            <h1 className="text-xl font-bold">{brand.name}</h1>
            <p className="text-[11px] text-gray-600">{brand.tagline}</p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-gray-600">Nomor Struk</div>
            <div className="font-mono text-sm font-semibold">{sale.code}</div>
            <div className="mt-1 text-[11px] text-gray-600">
              {formatDate(sale.sale_date)}
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="mb-4 grid grid-cols-2 gap-4 text-[12px]">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              Pelanggan
            </div>
            <div className="font-medium">
              {sale.customer_name || "Pelanggan Umum"}
            </div>
            {sale.customer_phone && (
              <div className="text-gray-700">{sale.customer_phone}</div>
            )}
            {sale.customer_address && (
              <div className="text-gray-700">{sale.customer_address}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              Channel
            </div>
            <div className="font-medium">
              {sale.channel?.name ?? "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
              Status
            </div>
            <div className="font-medium capitalize">{sale.status}</div>
          </div>
        </div>

        {/* Items */}
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b-2 border-gray-400">
              <th className="py-2 text-left">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Harga</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((it) => (
              <tr key={it.id} className="border-b border-gray-200">
                <td className="py-2">
                  <div className="font-medium">
                    {it.batch?.fish_type?.name ?? "Ikan"}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {it.batch?.grade?.name ?? "Belum disortir"}
                    {it.batch?.size_cm
                      ? ` · ${formatSize(it.batch.size_cm, it.batch.size_max_cm)}`
                      : ""}
                    {it.batch?.pond?.name ? ` · ${it.batch.pond.name}` : ""}
                  </div>
                </td>
                <td className="py-2 text-right font-mono">
                  {formatNumber(it.count)} ekor
                </td>
                <td className="py-2 text-right font-mono">
                  {formatRp(it.price_per_fish)}
                </td>
                <td className="py-2 text-right font-mono font-semibold">
                  {formatRp(it.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ml-auto mt-4 w-full max-w-xs text-[12px]">
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-mono">{formatRp(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Diskon</span>
              <span className="font-mono">-{formatRp(discount)}</span>
            </div>
          )}
          {shipping > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Ongkir</span>
              <span className="font-mono">{formatRp(shipping)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t-2 border-gray-400 pt-2 text-base">
            <span className="font-bold">TOTAL</span>
            <span className="font-mono font-bold">{formatRp(total)}</span>
          </div>
        </div>

        {sale.notes && (
          <div className="mt-6 border-t border-gray-300 pt-3 text-[11px] text-gray-700">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              Catatan
            </div>
            {sale.notes}
          </div>
        )}

        <div className="mt-8 text-center text-[10px] text-gray-500">
          Terima kasih atas pembelian Anda · {brand.name}
        </div>
      </div>
    </>
  );
}
