import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Send, RefreshCw, X, ArrowUpRight, KeyRound } from "lucide-react";
import { AiApi, type AnalysisResponse } from "@/api/endpoints";
import { useAuth } from "@/contexts/auth-context";
import { extractApiError } from "@/utils/api-error";
import { AiAnswer } from "@/components/ai/ai-answer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Tombol tanya AI yang mengambang di tiap halaman.
 *
 * Yang membuatnya berguna adalah konteksnya: pertanyaan dari halaman Penjualan
 * dikirim dengan penanda "penjualan", jadi jawabannya langsung menyorot omzet
 * dan saluran penjualan alih-alih mengulang ringkasan usaha secara umum.
 */

interface PageContext {
  /** Nilai yang dikenal server; lihat BusinessAnalyst::FOKUS. */
  key: string;
  label: string;
  contoh: string[];
}

const CONTEXTS: Record<string, PageContext> = {
  "/dashboard": {
    key: "beranda",
    label: "Beranda",
    contoh: ["Bagaimana kondisi usaha bulan ini?", "Apa yang perlu saya kerjakan minggu ini?"],
  },
  "/sales": {
    key: "penjualan",
    label: "Penjualan",
    contoh: [
      "Saluran mana yang paling menguntungkan?",
      "Jenis ikan apa yang paling laku?",
      "Kenapa omzet bulan ini turun?",
    ],
  },
  "/purchases": {
    key: "pembelian",
    label: "Pembelian",
    contoh: ["Pemasok mana yang paling murah?", "Ada PO yang belum diterima?"],
  },
  "/batches": {
    key: "stok",
    label: "Stok Ikan",
    contoh: ["Kenapa stok saya menumpuk?", "Ikan mana yang sudah lama tidak terjual?"],
  },
  "/ponds": {
    key: "kolam",
    label: "Kolam",
    contoh: ["Kolam mana yang kelebihan muatan?", "Kolam mana yang menganggur?"],
  },
  "/harvests": {
    key: "panen",
    label: "Panen",
    contoh: ["Bagaimana hasil panen belakangan ini?"],
  },
  "/sortings": {
    key: "sortir",
    label: "Sortir",
    contoh: ["Berapa ikan yang belum siap jual?", "Berapa susut saat sortir?"],
  },
  "/mortalities": {
    key: "kematian",
    label: "Ikan Mati",
    contoh: ["Apa penyebab kematian terbanyak?", "Kolam mana yang paling rawan?"],
  },
  "/stock-opnames": {
    key: "opname",
    label: "Stok Opname",
    contoh: ["Seberapa sering hitungan fisik meleset?"],
  },
  "/expenses": {
    key: "pengeluaran",
    label: "Pengeluaran",
    contoh: ["Biaya apa yang paling besar?", "Apa yang bikin biaya naik?"],
  },
  "/fish-types": {
    key: "jenis-ikan",
    label: "Jenis Ikan",
    contoh: ["Jenis mana yang paling banyak stoknya?"],
  },
  "/suppliers": {
    key: "pemasok",
    label: "Pemasok",
    contoh: ["Pemasok mana yang paling sering dipakai?"],
  },
};

function contextFor(pathname: string): PageContext | null {
  const match = Object.keys(CONTEXTS).find((path) => pathname.startsWith(path));

  return match ? CONTEXTS[match] : null;
}

export function AiAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const context = contextFor(location.pathname);

  // Gate yang sama dengan halaman Analisis AI: isinya omzet dan margin.
  const boleh = user?.role === "owner" || user?.role === "admin";

  const { data: status } = useQuery({
    queryKey: ["ai-status"],
    queryFn: AiApi.status,
    enabled: boleh,
    staleTime: 5 * 60_000,
  });

  const ask = useMutation({
    mutationFn: (q: string) => AiApi.analyse(q, context?.key),
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(extractApiError(e, "Gagal menanyakan ke AI.")),
  });

  // Halaman pengaturan & profil tidak punya sudut pandang data; tombolnya
  // disembunyikan daripada menjawab hal yang tidak nyambung.
  if (!boleh || !context) return null;

  const belumSiap = status?.siap === false;

  function submit() {
    const q = question.trim();
    if (q.length === 0) return;
    ask.mutate(q);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Tanya AI tentang ${context.label}`}
        aria-label={`Tanya AI tentang ${context.label}`}
        className="group fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-105 hover:bg-violet-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
      >
        <Sparkles className="h-5 w-5 transition-transform group-hover:scale-110 sm:h-6 sm:w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Tanya AI — {context.label}
            </DialogTitle>
            <DialogDescription>
              Jawabannya disorot ke {context.label.toLowerCase()}, memakai angka inventaris Anda
              sendiri.
            </DialogDescription>
          </DialogHeader>

          {belumSiap ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] leading-relaxed text-amber-700 dark:text-amber-400">
              <span className="mb-1 flex items-center gap-1.5 font-medium">
                <KeyRound className="h-4 w-4" />
                Fitur AI belum diaktifkan
              </span>
              {user?.role === "owner"
                ? "Pasang kunci API dulu di Pengaturan → Analisis AI."
                : "Minta pemilik memasang kunci API di Pengaturan → Analisis AI."}
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  // Enter mengirim; Shift+Enter untuk baris baru.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                maxLength={500}
                rows={2}
                placeholder={`Tanya apa saja tentang ${context.label.toLowerCase()}…`}
                className="resize-none"
                autoFocus
              />

              <div className="flex flex-wrap items-center gap-2">
                {context.contoh.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setQuestion(c)}
                    className="rounded-full bg-muted/60 px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {c}
                  </button>
                ))}
                <div className="flex-1" />
                {question && (
                  <Button variant="ghost" size="sm" onClick={() => setQuestion("")}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={ask.isPending || question.trim().length === 0}
                >
                  {ask.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Tanya
                </Button>
              </div>

              {ask.isPending && (
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              )}

              {result && !ask.isPending && (
                <div className="space-y-3 pt-1">
                  <AiAnswer
                    analisis={result.analisis}
                    question={result.meta.pertanyaan}
                    compact
                    maxItems={3}
                  />

                  <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                    <p className="text-[12px] text-muted-foreground">
                      Dibuat oleh {result.meta.model}
                      {result.meta.dari_cache && " (hasil tersimpan)"}. Periksa angkanya sebelum
                      mengambil keputusan besar.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setOpen(false);
                        navigate("/ai-analysis");
                      }}
                    >
                      Analisis lengkap
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
