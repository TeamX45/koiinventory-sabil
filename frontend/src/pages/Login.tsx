import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Fish, Lock, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { extractApiError } from "@/utils/api-error";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("owner@dkkoi.com");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Login berhasil. Selamat datang!");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const msg = extractApiError(err, "Email atau kata sandi salah.");
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-violet-500/30 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 h-[480px] w-[480px] rounded-full bg-amber-500/25 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 h-[420px] w-[420px] rounded-full bg-rose-500/25 blur-[120px]" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Left: branding panel */}
        <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 via-rose-500 to-violet-600 shadow-lg shadow-rose-500/30">
              <Fish className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">{brand.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {brand.tagline}
              </div>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Sparkles className="h-3.5 w-3.5" />
              Pelacakan stok real-time
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
              Kelola{" "}
              <span className="text-gradient-amber">stok ikan koi</span>
              <br />
              dari kolam ke pasar.
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Dashboard untuk monitoring 24 unit kolam, mencatat pembelian
              borong, sortir grade, sampai penjualan multi-channel — semua
              dengan audit trail otomatis.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-4">
              <Stat label="Lokasi" value="3" />
              <Stat label="Kolam" value="24" />
              <Stat label="Channel" value="7+" />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/60">
            © {brand.year} {brand.name}. {brand.description}.
          </p>
        </div>

        {/* Right: form panel */}
        <div className="flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-md">
            {/* Mobile branding */}
            <div className="lg:hidden mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 via-rose-500 to-violet-600 shadow-lg shadow-rose-500/30">
                <Fish className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight">DK Koi</div>
                <div className="text-[11px] text-muted-foreground">
                  Platform Inventaris
                </div>
              </div>
            </div>

            <div className="glass-elevated border-frost rounded-3xl p-8">
              <h2 className="text-2xl font-bold tracking-tight">Selamat Datang</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Masuk untuk melanjutkan ke dashboard
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@dkkoi.com"
                      className="pl-9 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Kata Sandi</Label>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Lupa kata sandi?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 pr-10 h-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || !email || !password}
                  className={cn(
                    "w-full h-11 text-sm font-semibold",
                    "bg-linear-to-r from-amber-500 via-rose-500 to-violet-600",
                    "hover:brightness-110 transition-all"
                  )}
                >
                  {submitting ? "Memproses…" : "Masuk"}
                </Button>
              </form>

              <div className="mt-6 border-t border-border/40 pt-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">
                  Akun demo
                </p>
                <div className="space-y-1.5 text-[12px]">
                  <DemoAccount
                    role="owner"
                    email="owner@dkkoi.com"
                    password="owner123"
                    onClick={() => {
                      setEmail("owner@dkkoi.com");
                      setPassword("owner123");
                    }}
                  />
                  <DemoAccount
                    role="admin"
                    email="admin@dkkoi.com"
                    password="admin123"
                    onClick={() => {
                      setEmail("admin@dkkoi.com");
                      setPassword("admin123");
                    }}
                  />
                  <DemoAccount
                    role="staff"
                    email="staff@dkkoi.com"
                    password="staff123"
                    onClick={() => {
                      setEmail("staff@dkkoi.com");
                      setPassword("staff123");
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur p-3 text-center">
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function DemoAccount({
  role,
  email,
  password,
  onClick,
}: {
  role: string;
  email: string;
  password: string;
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    owner: "from-amber-500 to-rose-500",
    admin: "from-blue-500 to-cyan-500",
    staff: "from-emerald-500 to-teal-500",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-lg border border-border/40 bg-background/30 px-3 py-2 transition-all hover:bg-background/60 hover:border-border"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full bg-linear-to-r px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white",
            colors[role]
          )}
        >
          {role}
        </span>
        <span className="font-mono text-muted-foreground">{email}</span>
      </div>
      <span className="font-mono text-[10px] text-muted-foreground/60">{password}</span>
    </button>
  );
}
