import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Send, KeyRound } from "lucide-react";
import { AiApi, type AnalysisResponse } from "@/api/endpoints";
import { AiAnswer } from "@/components/ai/ai-answer";
import { extractApiError } from "@/utils/api-error";
import { PageHeader, GlassCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatRp } from "@/utils/format";

/** Pertanyaan siap pakai — supaya user tidak menatap kotak kosong. */
const CONTOH_PERTANYAAN = [
  "Kenapa stok saya menumpuk?",
  "Jenis ikan mana yang paling menguntungkan?",
  "Apa yang bikin biaya bulan ini naik?",
  "Kolam mana yang perlu perhatian?",
];

/**
 * Angka yang dikirim ke AI, ditampilkan apa adanya. Tanpa ini, kesimpulan AI
 * tidak bisa ditelusuri — dan analisis yang tidak bisa dicek tidak layak
 * dipakai untuk mengambil keputusan.
 */
function BasisAngka({ data }: { data: AnalysisResponse["data"] }) {
  const baris: Array<[string, string]> = [
    ["Periode", `${data.periode.dari} s/d ${data.periode.sampai} (${data.periode.jendela_hari} hari)`],
    ["Stok aktif", `${formatNumber(data.stok.total_ekor_aktif)} ekor / ${formatNumber(data.stok.jumlah_batch_aktif)} batch`],
    ["Belum disortir", `${formatNumber(data.stok.belum_disortir.ekor)} ekor (${data.stok.belum_disortir.batch} batch)`],
    [
      `Mengendap >${data.stok.mengendap.lebih_dari_hari} hari`,
      `${formatNumber(data.stok.mengendap.ekor)} ekor (${data.stok.mengendap.batch} batch)`,
    ],
    ["Pembelian", `${data.pembelian.jumlah_po} PO — ${formatRp(data.pembelian.total_rupiah)}`],
    ["Penjualan", `${data.penjualan.jumlah_transaksi} transaksi — ${formatRp(data.penjualan.omzet)}`],
    ["Pengeluaran", formatRp(data.pengeluaran.total_rupiah)],
    [
      "Kematian",
      `${formatNumber(data.kematian.total_ekor)} ekor${
        data.kematian.persen_dari_stok !== null ? ` (${data.kematian.persen_dari_stok}%)` : ""
      }`,
    ],
    [
      "Selisih beli vs jual",
      data.margin_kasar.selisih_per_ekor !== null
        ? `${formatRp(data.margin_kasar.selisih_per_ekor)} per ekor${
            data.margin_kasar.persen !== null ? ` (${data.margin_kasar.persen}%)` : ""
          }`
        : "Belum bisa dihitung",
    ],
  ];

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
        Lihat angka yang dipakai analisis ini
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[13px]">
          <tbody>
            {baris.map(([label, nilai]) => (
              <tr key={label} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{label}</td>
                <td className="py-2 font-medium text-foreground">{nilai}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Selisih beli vs jual belum dikurangi pakan, tenaga kerja, dan penyusutan — jadi
          bukan laba bersih.
        </p>
      </div>
    </details>
  );
}

export default function AiAnalysisPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const { data: status } = useQuery({
    queryKey: ["ai-status"],
    queryFn: AiApi.status,
    staleTime: 5 * 60_000,
  });

  const analyse = useMutation({
    mutationFn: (q?: string) => AiApi.analyse(q),
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(extractApiError(e, "Analisis gagal dibuat.")),
  });

  const belumSiap = status?.siap === false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analisis AI"
        description="Membaca angka inventaris Anda dan menjelaskan apa artinya untuk usaha."
        actions={
          <Button
            onClick={() => {
              setQuestion("");
              analyse.mutate(undefined);
            }}
            disabled={analyse.isPending || belumSiap}
          >
            {analyse.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Analisis sekarang
          </Button>
        }
      />

      {belumSiap && (
        <GlassCard className="ring-1 ring-amber-500/20">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">
                Fitur ini belum diaktifkan
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Kunci API Gemini belum dipasang. Ambil kunci gratis di{" "}
                <span className="font-medium text-foreground">aistudio.google.com/apikey</span>,
                lalu pasang lewat <span className="font-medium text-foreground">Pengaturan
                → Analisis AI</span>. Tidak perlu menyentuh server.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <label className="text-[13px] font-medium text-foreground" htmlFor="ai-question">
          Atau tanyakan sesuatu tentang data Anda
        </label>
        <Textarea
          id="ai-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Contoh: kenapa stok saya menumpuk?"
          className="mt-2 resize-none"
          disabled={belumSiap}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {CONTOH_PERTANYAAN.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setQuestion(c)}
              disabled={belumSiap}
              className="rounded-full bg-muted/60 px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {c}
            </button>
          ))}
          <div className="flex-1" />
          <Button
            variant="secondary"
            onClick={() => analyse.mutate(question)}
            disabled={analyse.isPending || belumSiap || question.trim().length === 0}
          >
            <Send className="h-4 w-4" />
            Tanya
          </Button>
        </div>
      </GlassCard>

      {analyse.isPending && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {result && !analyse.isPending && (
        <div className="space-y-4">
          <AiAnswer analisis={result.analisis} question={result.meta.pertanyaan} />

          <GlassCard variant="subtle">
            <BasisAngka data={result.data} />
            <p className="mt-4 border-t border-border/40 pt-3 text-[12px] text-muted-foreground">
              Dibuat oleh {result.meta.model}
              {result.meta.dari_cache && " (hasil tersimpan, data belum berubah)"}. Analisis ini
              alat bantu, bukan pengganti penilaian Anda sendiri — periksa angkanya sebelum
              mengambil keputusan besar.
            </p>
          </GlassCard>
        </div>
      )}

      {!result && !analyse.isPending && !belumSiap && (
        <GlassCard variant="subtle" className="text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-[14px] font-medium text-foreground">Belum ada analisis</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Tekan “Analisis sekarang” untuk ringkasan kesehatan usaha 30 hari terakhir, atau
            ajukan pertanyaan sendiri di atas.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
