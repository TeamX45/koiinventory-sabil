import { AlertTriangle, CheckCircle2, Info, Lightbulb, Sparkles } from "lucide-react";
import type { AnalysisFinding, BusinessAnalysis } from "@/api/endpoints";
import { GlassCard } from "@/components/common";
import { cn } from "@/lib/utils";

/**
 * Tampilan satu jawaban AI, dipakai halaman Analisis AI maupun popup tanya
 * cepat. Sengaja satu komponen: dua salinan tampilan pasti akan menyimpang.
 */

const TINGKAT = {
  penting: {
    label: "Penting",
    icon: AlertTriangle,
    ring: "ring-rose-500/20",
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  perhatian: {
    label: "Perhatian",
    icon: Info,
    ring: "ring-amber-500/20",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  baik: {
    label: "Baik",
    icon: CheckCircle2,
    ring: "ring-emerald-500/20",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
} as const;

export function FindingCard({
  finding,
  compact = false,
}: {
  finding: AnalysisFinding;
  compact?: boolean;
}) {
  const style = TINGKAT[finding.tingkat] ?? TINGKAT.perhatian;
  const Icon = style.icon;

  return (
    <GlassCard className={cn("ring-1", style.ring, compact && "!p-3")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-lg",
            compact ? "h-6 w-6" : "h-8 w-8",
            style.chip,
          )}
        >
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-foreground sm:text-[14px]">
              {finding.judul}
            </h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", style.chip)}>
              {style.label}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {finding.penjelasan}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

export function AiAnswer({
  analisis,
  question,
  compact = false,
  maxItems,
}: {
  analisis: BusinessAnalysis;
  question?: string | null;
  compact?: boolean;
  maxItems?: number;
}) {
  const temuan = maxItems ? analisis.temuan?.slice(0, maxItems) : analisis.temuan;
  const rekomendasi = maxItems
    ? analisis.rekomendasi?.slice(0, maxItems)
    : analisis.rekomendasi;

  return (
    <div className="space-y-4">
      <GlassCard gradient="violet" className={cn(compact && "!p-3")}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            {question && (
              <p className="mb-1 text-[13px] font-medium text-foreground">{question}</p>
            )}
            <p className="text-[14px] leading-relaxed text-foreground">{analisis.ringkasan}</p>
          </div>
        </div>
      </GlassCard>

      {!compact && !!analisis.angka_kunci?.length && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {analisis.angka_kunci.map((a) => (
            <GlassCard key={a.label} variant="subtle">
              <p className="text-[12px] text-muted-foreground">{a.label}</p>
              <p className="mt-1 text-[18px] font-semibold text-foreground">{a.nilai}</p>
              {a.catatan && (
                <p className="mt-1 text-[12px] text-muted-foreground">{a.catatan}</p>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {!!temuan?.length && (
        <div className="space-y-2">
          <h2 className="text-[13px] font-semibold text-foreground sm:text-[15px]">Temuan</h2>
          {temuan.map((t, i) => (
            <FindingCard key={`${t.judul}-${i}`} finding={t} compact={compact} />
          ))}
        </div>
      )}

      {!!rekomendasi?.length && (
        <div className="space-y-2">
          <h2 className="text-[13px] font-semibold text-foreground sm:text-[15px]">
            Saran tindakan
          </h2>
          {rekomendasi.map((r, i) => (
            <GlassCard key={`${r.aksi}-${i}`} className={cn(compact && "!p-3")}>
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400",
                    compact ? "h-6 w-6" : "h-8 w-8",
                  )}
                >
                  <Lightbulb className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-foreground sm:text-[14px]">
                    {r.aksi}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {r.alasan}
                  </p>
                  {!compact && r.dampak && (
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Dampak: </span>
                      {r.dampak}
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
