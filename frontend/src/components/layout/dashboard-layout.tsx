import { Outlet, useLocation } from "react-router-dom";
import { Bell, Moon, Sun, Menu, Sparkles } from "lucide-react";
import { usePrefetchData } from "@/hooks/use-prefetch-data";
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/config/brand";
import { AppSidebar } from "./app-sidebar";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":         { title: "Beranda",          subtitle: "Ringkasan stok, pembelian & penjualan" },
  "/ponds":             { title: "Kolam",            subtitle: "Daftar 24 unit kolam & akuarium" },
  "/batches":           { title: "Batch Ikan",       subtitle: "Kelompok ikan per kolam" },
  "/suppliers":         { title: "Pemasok",          subtitle: "Pemasok ikan dari sistem borong" },
  "/locations":         { title: "Lokasi",           subtitle: "Lokasi tempat kolam berada" },
  "/pond-categories":   { title: "Kategori Kolam",   subtitle: "Klasifikasi fungsi kolam" },
  "/purchases":         { title: "Pembelian",        subtitle: "Pesanan pembelian dari pemasok" },
  "/harvests":          { title: "Panen",            subtitle: "Hasil panen kolam tanah" },
  "/sortings":          { title: "Sortir",           subtitle: "Distribusi grade & harga per ekor" },
  "/mortalities":       { title: "Ikan Mati",        subtitle: "Catatan kematian ikan & analisis penyebab" },
  "/sales":             { title: "Penjualan",        subtitle: "Transaksi penjualan ikan" },
  "/stock-opnames":     { title: "Stok Opname",      subtitle: "Hitung fisik vs stok sistem" },
  "/settings/profile":  { title: "Profil Saya",      subtitle: "Kelola akun & keamanan" },
  "/settings/users":    { title: "Manajemen Pengguna", subtitle: "Kelola pemilik, admin, dan staf" },
};

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  const toggleTheme = () => {
    document.documentElement.classList.add("theme-transition");
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 300);
  };

  const isDark = resolvedTheme === "dark";

  if (!mounted || !resolvedTheme) {
    return (
      <button
        className="group relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground ring-1 ring-border/50"
        disabled
      >
        <div className="h-4.5 w-4.5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="group relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground ring-1 ring-border/50 transition-all duration-300 hover:bg-muted hover:text-foreground hover:ring-border hover:shadow-sm"
      title={isDark ? "Mode terang" : "Mode gelap"}
    >
      <div className="relative h-4.5 w-4.5">
        <Sun
          className={cn(
            "absolute inset-0 h-4.5 w-4.5 transition-all duration-300",
            isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 h-4.5 w-4.5 transition-all duration-300",
            !isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          )}
        />
      </div>
    </button>
  );
}

function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground ring-1 ring-border/50 transition-all hover:bg-muted hover:text-foreground hover:ring-border md:hidden"
      title="Menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

function NotificationButton() {
  const notifications = [
    { id: 1, title: "Stok belum disortir", desc: "Ada batch borong menunggu sortir", time: "Baru saja", type: "warning" as const },
    { id: 2, title: "Penjualan baru",       desc: "Order Tokopedia masuk",            time: "1 jam lalu", type: "success" as const },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="group relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground ring-1 ring-border/50 transition-all duration-300 hover:bg-muted hover:text-foreground hover:ring-border hover:shadow-sm">
          <Bell className="h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
              {notifications.length}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-80 overflow-hidden rounded-2xl border-border/50 p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifikasi</span>
          </div>
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
            {notifications.length} baru
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              className="flex w-full items-start gap-3 border-b border-border/30 px-4 py-3 text-left transition-colors hover:bg-muted/50 last:border-0"
            >
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  notif.type === "warning" && "bg-amber-500/10 text-amber-500",
                  notif.type === "success" && "bg-emerald-500/10 text-emerald-500"
                )}
              >
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-[13px] font-medium text-foreground">{notif.title}</p>
                <p className="truncate text-[12px] text-muted-foreground">{notif.desc}</p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">{notif.time}</p>
              </div>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeaderTitle() {
  const location = useLocation();
  const matched = Object.keys(pageTitles).find((path) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard" || location.pathname === "/"
      : location.pathname.startsWith(path)
  );
  const pageInfo = matched ? pageTitles[matched] : { title: brand.name, subtitle: "" };

  return (
    <div className="hidden flex-col md:flex">
      <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
        {pageInfo.title}
      </h1>
      <p className="text-[11px] text-muted-foreground">{pageInfo.subtitle}</p>
    </div>
  );
}

export default function DashboardLayout() {
  usePrefetchData();
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="bg-slate-50/50 dark:bg-slate-950/50">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            <MobileSidebarTrigger />
            <HeaderTitle />
            <div className="flex-1" />
            <div className="hidden h-6 w-px bg-border/50 md:block" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationButton />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
      <Toaster position="top-right" />
    </SidebarProvider>
  );
}
