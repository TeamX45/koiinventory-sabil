import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Phone, Shield, Save, KeyRound, Sparkles } from "lucide-react";
import { ProfileApi } from "@/api/endpoints";
import { useAuth } from "@/contexts/auth-context";
import { useFeedback } from "@/contexts/feedback-context";
import { PageHeader, GlassCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/utils/format";
import { extractApiError } from "@/utils/api-error";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { success } = useFeedback();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfile = useMutation({
    mutationFn: () => ProfileApi.update({ name, phone }),
    onMutate: () => {
      success({
        title: "Profil Diperbarui",
        message: `Informasi akun ${name} berhasil disimpan.`,
      });
    },
    onSuccess: () => {
      refresh();
    },
    onError: (e) => toast.error(extractApiError(e, "Gagal memperbarui profil.")),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      ProfileApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      }),
    onMutate: () => {
      // Reset fields INSTAN
      const snapshot = { currentPassword, newPassword, confirmPassword };
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      return { snapshot };
    },
    onSuccess: () => {
      success({
        title: "Kata Sandi Diubah",
        message: "Kata sandi baru aktif. Gunakan kata sandi baru saat masuk berikutnya.",
      });
    },
    onError: (e: unknown, _v, ctx) => {
      // Restore agar user bisa retry tanpa retype semua
      if (ctx?.snapshot) {
        setCurrentPassword(ctx.snapshot.currentPassword);
        setNewPassword(ctx.snapshot.newPassword);
        setConfirmPassword(ctx.snapshot.confirmPassword);
      }
      toast.error(extractApiError(e, "Gagal mengubah kata sandi."));
    },
  });

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const ROLE_TONE: Record<string, string> = {
    owner: "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-500/10",
    admin: "border-blue-300 text-blue-700 dark:text-blue-400 bg-blue-500/10",
    staff: "border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil Saya"
        description="Kelola informasi akun dan keamanan"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Identity card */}
        <GlassCard gradient="violet" className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 via-rose-500 to-violet-600 text-2xl font-bold text-white shadow-lg shadow-rose-500/30">
              {initials}
            </div>
            <h2 className="mt-4 text-lg font-bold tracking-tight">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>

            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className={ROLE_TONE[user.role]}>
                <Shield className="h-3 w-3" />
                {user.role}
              </Badge>
              <Badge
                variant="outline"
                className={
                  user.is_active
                    ? "border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                    : ""
                }
              >
                <Sparkles className="h-3 w-3" />
                {user.is_active ? "aktif" : "non-aktif"}
              </Badge>
            </div>

            <Separator className="my-4" />

            <ul className="w-full space-y-2 text-sm text-left">
              <li className="flex items-center justify-between text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> Email
                </span>
                <span className="font-medium text-foreground">{user.email}</span>
              </li>
              <li className="flex items-center justify-between text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> Telepon
                </span>
                <span className="font-medium text-foreground">
                  {user.phone ?? "—"}
                </span>
              </li>
            </ul>
          </div>
        </GlassCard>

        {/* Right: Edit form */}
        <div className="space-y-4 lg:col-span-2">
          <GlassCard>
            <div className="mb-4">
              <h3 className="font-semibold">Informasi Akun</h3>
              <p className="text-[12px] text-muted-foreground">
                Nama dan telepon dapat diubah. Email dikelola oleh owner.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email (read-only)</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Telepon</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xx xxxx xxxx"
                />
              </div>
              <Button
                disabled={name === user.name && phone === (user.phone ?? "")}
                onClick={() => updateProfile.mutate()}
              >
                <Save className="h-4 w-4" />
                Simpan Perubahan
              </Button>
            </div>
          </GlassCard>

          <GlassCard gradient="rose">
            <div className="mb-4">
              <h3 className="font-semibold">Ubah Kata Sandi</h3>
              <p className="text-[12px] text-muted-foreground">
                Pastikan kata sandi baru minimal 8 karakter.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kata Sandi Lama</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Kata Sandi Baru</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Konfirmasi Kata Sandi</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <Button
                variant="destructive"
                disabled={
                  !currentPassword ||
                  !newPassword ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                onClick={() => changePassword.mutate()}
              >
                <KeyRound className="h-4 w-4" />
                Ubah Kata Sandi
              </Button>
              {newPassword && newPassword.length < 8 && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  Kata sandi minimal 8 karakter.
                </p>
              )}
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  Konfirmasi kata sandi tidak cocok.
                </p>
              )}
            </div>
          </GlassCard>

          <GlassCard variant="subtle">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Akun bergabung sejak</p>
                <p className="text-[12px] text-muted-foreground">
                  {formatDate(user.id ? new Date().toISOString() : "")}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
