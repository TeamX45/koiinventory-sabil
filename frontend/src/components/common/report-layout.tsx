import { Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/utils/format";

/**
 * Kerangka laporan yang bisa dicetak.
 *
 * "Ekspor PDF" di sini memakai dialog cetak bawaan browser (Simpan sebagai
 * PDF), pola yang sudah dipakai halaman struk penjualan. Dipilih karena tidak
 * menambah pustaka PDF di bundel maupun dependensi composer baru yang harus
 * ikut dipasang saat deploy — hasil akhirnya tetap berkas PDF sungguhan.
 */
export function ReportLayout({
  title,
  periodFrom,
  periodTo,
  backTo,
  backLabel,
  filters,
  summary,
  children,
}: {
  title: string;
  periodFrom: string;
  periodTo: string;
  backTo: string;
  backLabel: string;
  filters?: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          .report, .report * { visibility: visible !important; }
          .report { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          aside, header, nav, .sidebar { display: none !important; }
          .report table { font-size: 10px; }
          .report thead { display: table-header-group; }
          .report tr { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Cetak / Simpan PDF
        </Button>
      </div>

      {filters && <div className="no-print mb-4">{filters}</div>}

      <div className="report space-y-4 rounded-xl bg-white p-5 text-slate-900 print:rounded-none print:p-0">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-[18px] font-bold tracking-tight">{title}</h1>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Periode {formatDate(periodFrom)} s/d {formatDate(periodTo)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold">{brand.name}</p>
            <p className="text-[11px] text-slate-500">
              Dicetak {formatDate(new Date().toISOString().slice(0, 10))}
            </p>
          </div>
        </div>

        {summary}

        {children}
      </div>
    </>
  );
}

/** Sel ringkasan di kepala laporan. */
export function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}
