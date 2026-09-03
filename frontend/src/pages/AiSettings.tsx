import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  PlugZap,
  RefreshCw,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { AiSettingsApi } from "@/api/endpoints";
import { extractApiError } from "@/utils/api-error";
import { useFeedback } from "@/contexts/feedback-context";
import { PageHeader, GlassCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function AiSettingsPage() {
  const qc = useQueryClient();
  const { confirm } = useFeedback();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: setting, isLoading } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: AiSettingsApi.show,
  });

  // Daftar model hanya diambil saat diminta: tiap pemanggilan menembak API
  // Google, dan kuotanya terbatas.
  const models = useMutation({
    mutationFn: AiSettingsApi.models,
    onError: (e) => toast.error(extractApiError(e, "Gagal mengambil daftar model.")),
  });

  function afterChange(message: string) {
    toast.success(message);
    qc.invalidateQueries({ queryKey: ["ai-settings"] });
    // Halaman Analisis AI membaca status yang sama.
    qc.invalidateQueries({ queryKey: ["ai-status"] });
  }

  const save = useMutation({
    mutationFn: (payload: { api_key?: string; model?: string | null }) =>
      AiSettingsApi.update(payload),
    onSuccess: (res) => {
      setApiKey("");
      afterChange(res.message);
    },
    onError: (e) => toast.error(extractApiError(e, "Gagal menyimpan pengaturan.")),
  });

  const test = useMutation({
    mutationFn: AiSettingsApi.test,
    onSuccess: (res) => afterChange(res.message),
    onError: (e) => toast.error(extractApiError(e, "Uji koneksi gagal.")),
  });

  const clear = useMutation({
    mutationFn: AiSettingsApi.clear,
    onSuccess: (res) => afterChange(res.message),
    onError: (e) => toast.error(extractApiError(e, "Gagal menghapus kunci.")),
  });

  async function handleClear() {
    const ok = await confirm({
      title: "Hapus kunci API?",
      description:
        "Analisis AI berhenti bekerja sampai kunci baru dimasukkan. Data inventaris tidak terpengaruh.",
      confirmLabel: "Ya, Hapus",
    });
    if (ok) clear.mutate();
  }

  const terpasang = setting?.terpasang ?? false;
  const modelOptions = models.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Analisis AI"
        description="Kunci API Gemini dipakai untuk membaca data inventaris dan menjelaskan artinya."
        breadcrumbs={[{ label: "Pengaturan" }, { label: "Analisis AI" }]}
      />

      <GlassCard className={cn("ring-1", terpasang ? "ring-emerald-500/20" : "ring-amber-500/20")}>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              terpasang
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            {terpasang ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-foreground">
              {isLoading
                ? "Memeriksa…"
                : terpasang
                  ? "Analisis AI aktif"
                  : "Kunci API belum dipasang"}
            </h2>
            {terpasang ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                Kunci <code className="rounded bg-muted px-1">{setting?.preview}</code>
                {setting?.sumber === "env"
                  ? " berasal dari berkas .env server."
                  : " tersimpan terenkripsi di database."}{" "}
                Model: <span className="font-medium text-foreground">{setting?.model}</span>
              </p>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Ambil kunci gratis di Google AI Studio, lalu tempel di bawah. Menu Analisis AI
                tetap ada tapi belum bisa dipakai sampai kunci terisi.
              </p>
            )}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Buka Google AI Studio
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <Label htmlFor="api-key" className="text-[13px]">
          Kunci API Gemini
        </Label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={terpasang ? "Isi untuk mengganti kunci yang ada" : "AIza…"}
              autoComplete="off"
              spellCheck={false}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              title={showKey ? "Sembunyikan" : "Tampilkan"}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            onClick={() => save.mutate({ api_key: apiKey })}
            disabled={apiKey.trim().length < 20 || save.isPending}
          >
            <KeyRound className="h-4 w-4" />
            Simpan
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Kunci disimpan terenkripsi dan tidak pernah ditampilkan utuh lagi setelah disimpan.
        </p>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Label className="text-[13px]">Model</Label>
            <Select
              value={setting?.model ?? ""}
              onValueChange={(value) => save.mutate({ model: value })}
              disabled={modelOptions.length === 0 || save.isPending}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={setting?.model ?? "Pilih model"} />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nama ? `${m.nama} — ${m.id}` : m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="secondary"
            onClick={() => models.mutate()}
            disabled={!terpasang || models.isPending}
          >
            {models.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Muat daftar model
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Nama model Gemini berganti cukup sering. Tombol di atas menanyakan langsung ke Google
          model apa yang tersedia untuk kunci Anda, jadi tidak perlu menebak.
        </p>
      </GlassCard>

      <GlassCard variant="subtle">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => test.mutate()} disabled={!terpasang || test.isPending}>
            {test.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            Uji koneksi
          </Button>
          <span className="text-[12px] text-muted-foreground">
            Mengirim satu permintaan kecil untuk memastikan kunci dan model benar-benar jalan.
          </span>
          <div className="flex-1" />
          {setting?.sumber === "pengaturan" && (
            <Button variant="ghost" onClick={handleClear} disabled={clear.isPending}>
              <Trash2 className="h-4 w-4" />
              Hapus kunci
            </Button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
