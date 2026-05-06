import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Waves,
  Boxes,
  Users,
  ShoppingCart,
  Sprout,
  Filter,
  Skull,
  ClipboardCheck,
  MapPin,
  Layers,
  Award,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Receipt,
  Database,
  Cog,
  Fish,
  LogOut,
  User as UserIcon,
  Settings,
  UserCog,
  UserCircle,
} from "lucide-react";
import { brand } from "@/config/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: keyof typeof colorVariants;
}

interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: keyof typeof colorVariants;
  items: NavItem[];
}

const colorVariants = {
  violet: {
    bg: "bg-violet-500",
    bgLight: "bg-violet-500/10 dark:bg-violet-500/20",
    text: "text-violet-600 dark:text-violet-400",
    shadow: "shadow-violet-500/25",
    ring: "ring-violet-500/20",
  },
  emerald: {
    bg: "bg-emerald-500",
    bgLight: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    shadow: "shadow-emerald-500/25",
    ring: "ring-emerald-500/20",
  },
  blue: {
    bg: "bg-blue-500",
    bgLight: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    shadow: "shadow-blue-500/25",
    ring: "ring-blue-500/20",
  },
  amber: {
    bg: "bg-amber-500",
    bgLight: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    shadow: "shadow-amber-500/25",
    ring: "ring-amber-500/20",
  },
  rose: {
    bg: "bg-rose-500",
    bgLight: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
    shadow: "shadow-rose-500/25",
    ring: "ring-rose-500/20",
  },
  cyan: {
    bg: "bg-cyan-500",
    bgLight: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    shadow: "shadow-cyan-500/25",
    ring: "ring-cyan-500/20",
  },
  slate: {
    bg: "bg-slate-500",
    bgLight: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-600 dark:text-slate-400",
    shadow: "shadow-slate-500/25",
    ring: "ring-slate-500/20",
  },
};

const mainNavItem: NavItem = {
  title: "Beranda",
  href: "/dashboard",
  icon: LayoutDashboard,
  color: "violet",
};

const navGroups: NavGroup[] = [
  {
    title: "Operasional",
    icon: Receipt,
    color: "emerald",
    items: [
      { title: "Pembelian", href: "/purchases", icon: ShoppingCart, color: "emerald" },
      { title: "Panen", href: "/harvests", icon: Sprout, color: "amber" },
      { title: "Sortir", href: "/sortings", icon: Filter, color: "blue" },
      { title: "Penjualan", href: "/sales", icon: TrendingUp, color: "rose" },
      { title: "Ikan Mati", href: "/mortalities", icon: Skull, color: "rose" },
      { title: "Stok Opname", href: "/stock-opnames", icon: ClipboardCheck, color: "blue" },
    ],
  },
  {
    title: "Inventaris",
    icon: Database,
    color: "blue",
    items: [
      { title: "Kolam", href: "/ponds", icon: Waves, color: "cyan" },
      { title: "Inventaris", href: "/batches", icon: Boxes, color: "amber" },
    ],
  },
  {
    title: "Data Master",
    icon: Database,
    color: "slate",
    items: [
      { title: "Lokasi", href: "/locations", icon: MapPin, color: "amber" },
      { title: "Kategori Kolam", href: "/pond-categories", icon: Layers, color: "violet" },
      { title: "Grade", href: "/grades", icon: Award, color: "amber" },
      { title: "Supplier", href: "/suppliers", icon: Users, color: "emerald" },
    ],
  },
];

const settingsGroupAll: NavItem[] = [
  { title: "Profil Saya", href: "/settings/profile", icon: UserCircle, color: "violet" },
];

const settingsGroupOwner: NavItem[] = [
  { title: "Pengguna", href: "/settings/users", icon: UserCog, color: "blue" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = isMobile ? false : state === "collapsed";

  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "Operasional",
    "Inventaris",
    "Data Master",
    "Pengaturan",
  ]);

  // Build settings group dynamically based on role
  const dynamicNavGroups: NavGroup[] = [
    ...navGroups,
    {
      title: "Pengaturan",
      icon: Settings,
      color: "slate",
      items: [
        ...settingsGroupAll,
        ...(user?.role === "owner" ? settingsGroupOwner : []),
      ],
    },
  ];

  const handleNavigate = (href: string) => {
    navigate(href);
    if (isMobile) setOpenMobile(false);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => isActive(item.href));

  const toggleGroup = (title: string) =>
    setExpandedGroups((prev) =>
      prev.includes(title) ? prev.filter((g) => g !== title) : [...prev, title]
    );

  const renderNavItem = (item: NavItem, inGroup = false) => {
    const active = isActive(item.href);
    const colors = colorVariants[item.color];

    if (isCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleNavigate(item.href)}
              className={cn(
                "group/item relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300",
                active
                  ? cn(colors.bgLight, colors.text, "shadow-sm", colors.ring, "ring-1")
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {active && (
                <span className={cn("absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full", colors.bg)} />
              )}
              <item.icon
                className={cn(
                  "h-4.5 w-4.5 transition-transform duration-300",
                  !active && "group-hover/item:scale-110"
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", colors.bg)} />
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <button
        key={item.href}
        onClick={() => handleNavigate(item.href)}
        className={cn(
          "group/item relative flex w-full items-center gap-3 rounded-xl px-3 text-[13px] transition-all duration-300",
          inGroup ? "h-10" : "h-11",
          active
            ? cn(colors.bgLight, colors.text, "font-medium shadow-sm", colors.ring, "ring-1")
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <div
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300",
            active
              ? cn("h-5 opacity-100", colors.bg, "shadow-sm", colors.shadow)
              : "h-0 bg-muted-foreground/30 opacity-0 group-hover/item:h-3 group-hover/item:opacity-60"
          )}
        />
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-lg transition-all duration-300",
            inGroup ? "h-7 w-7" : "h-8 w-8",
            active
              ? cn(colors.bg, "text-white shadow-md", colors.shadow)
              : "bg-muted/50 group-hover/item:bg-muted"
          )}
        >
          <item.icon
            className={cn(
              inGroup ? "h-3.5 w-3.5" : "h-4 w-4",
              "transition-transform duration-300",
              !active && "group-hover/item:scale-110"
            )}
          />
        </div>
        <span className="transition-all duration-300 group-hover/item:translate-x-0.5">
          {item.title}
        </span>
        {active && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
      </button>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 overflow-visible">
      <SidebarHeader>
        <div
          className={cn(
            "flex items-center gap-3 py-4 transition-all duration-200",
            isCollapsed ? "justify-center px-2" : "px-4"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 via-rose-500 to-violet-600 shadow-lg shadow-rose-500/25">
            <Fish className="h-4.5 w-4.5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold tracking-tight">{brand.name}</span>
              <span className="text-[11px] font-medium text-muted-foreground/70">
                {brand.tagline}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleSidebar}
            className={cn(
              "absolute -right-3 top-[68px] z-50",
              "flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-md transition-all duration-200",
              "text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-lg"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {isCollapsed ? "Perluas" : "Ciutkan"}
        </TooltipContent>
      </Tooltip>

      <SidebarContent
        className={cn(
          "py-2 transition-all duration-200",
          isCollapsed ? "px-2" : "px-3"
        )}
      >
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className={cn("gap-1.5", isCollapsed && "items-center")}>
              <SidebarMenuItem className={isCollapsed ? "w-auto" : "w-full"}>
                {renderNavItem(mainNavItem)}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {dynamicNavGroups.map((group) => {
          const groupColors = colorVariants[group.color];
          const isExpanded = expandedGroups.includes(group.title);
          const groupActive = isGroupActive(group);

          if (isCollapsed) {
            return (
              <SidebarGroup key={group.title} className="mt-2">
                <SidebarGroupContent>
                  <SidebarMenu className="items-center gap-1">
                    <div className="my-1 flex h-6 w-6 items-center justify-center">
                      <div
                        className={cn(
                          "h-1 w-1 rounded-full",
                          groupActive ? groupColors.bg : "bg-muted-foreground/30"
                        )}
                      />
                    </div>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.href} className="w-auto">
                        {renderNavItem(item, true)}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={group.title} className="mt-2">
              <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(group.title)}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel
                    className={cn(
                      "group/label flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-muted/50",
                      groupActive ? groupColors.text : "text-muted-foreground"
                    )}
                  >
                    <group.icon className="h-4 w-4" />
                    <span className="flex-1">{group.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isExpanded ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="mt-1 gap-1 pl-2">
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.href} className="w-full">
                          {renderNavItem(item, true)}
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter
        className={cn("transition-all duration-200", isCollapsed ? "p-2" : "p-3")}
      >
        {user && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "group/user relative flex w-full items-center overflow-hidden rounded-2xl transition-all duration-300 focus:outline-none",
                isCollapsed
                  ? "justify-center p-1"
                  : "gap-3 bg-linear-to-r from-slate-100 to-slate-50 p-2.5 hover:from-slate-200 hover:to-slate-100 dark:from-slate-800 dark:to-slate-900 dark:hover:from-slate-700 dark:hover:to-slate-800"
              )}
            >
              {!isCollapsed && (
                <div className="absolute inset-0 bg-linear-to-r from-rose-500/0 via-rose-500/5 to-amber-500/0 opacity-0 transition-opacity duration-300 group-hover/user:opacity-100" />
              )}
              <div className="relative">
                <div
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 via-rose-500 to-violet-600 font-semibold text-white shadow-md transition-transform duration-300 group-hover/user:scale-105",
                    isCollapsed ? "h-9 w-9 text-[11px]" : "h-10 w-10 text-xs"
                  )}
                >
                  {getInitials(user.name)}
                </div>
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-500 ring-2 ring-background",
                    isCollapsed ? "h-2.5 w-2.5" : "h-3 w-3"
                  )}
                />
              </div>
              {!isCollapsed && (
                <>
                  <div className="relative flex flex-1 flex-col items-start overflow-hidden">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {user.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span className="truncate text-[11px] font-medium text-muted-foreground">
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-background/80 transition-colors group-hover/user:bg-background">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 group-hover/user:translate-x-0.5" />
                  </div>
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isCollapsed ? "center" : "end"}
            side="top"
            sideOffset={12}
            className="w-64 overflow-hidden rounded-2xl border-border/50 p-0 shadow-xl"
          >
            <div className="bg-linear-to-br from-amber-500 via-rose-500 to-violet-600 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-white backdrop-blur-sm">
                  {getInitials(user.name)}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-white">{user.name}</span>
                  <span className="text-xs text-white/70">{user.email}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                  {user.role}
                </div>
                <div className="flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-medium text-emerald-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Online
                </div>
              </div>
            </div>
            <div className="p-2">
              <DropdownMenuItem className="h-11 cursor-pointer gap-3 rounded-xl px-3 transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                  <UserIcon className="h-4 w-4 text-violet-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">Profil Saya</span>
                  <span className="text-[11px] text-muted-foreground">
                    Pengaturan akun
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="h-11 cursor-pointer gap-3 rounded-xl px-3 transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10">
                  <Cog className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">Pengaturan</span>
                  <span className="text-[11px] text-muted-foreground">
                    Konfigurasi sistem
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  await logout();
                  navigate("/login", { replace: true });
                }}
                className="mt-1 h-11 cursor-pointer gap-3 rounded-xl px-3 text-red-600 transition-colors focus:text-red-600 dark:text-red-400"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                  <LogOut className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">Keluar</span>
                  <span className="text-[11px] text-red-500/70 dark:text-red-400/70">
                    Akhiri sesi Anda
                  </span>
                </div>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>}
      </SidebarFooter>
    </Sidebar>
  );
}
