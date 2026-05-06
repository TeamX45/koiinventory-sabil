import { useQuery } from "@tanstack/react-query";
import {
  Fish,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Wallet,
} from "lucide-react";
import { api } from "@/api/client";
import { brand } from "@/config/brand";
import { GlassCard, StatCard, PageHeader } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRp, formatNumber, formatRpShort } from "@/utils/format";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface TopFishType {
  fish_type_id: number;
  name: string;
  group: string;
  total: number;
  value: number;
}

interface ValuationByLocation {
  location: string;
  ekor: number;
  value: number;
}

interface TopPond {
  id: number;
  name: string;
  location: string | null;
  stock: number;
}

interface TrendDay {
  date: string;
  in: number;
  out: number;
  net: number;
}

interface ExpenseByCategory {
  category: string;
  icon: string | null;
  total: number;
}

interface DashboardSummary {
  total_active_stock: number;
  unsorted_stock: number;
  total_valuation: number;
  purchase_this_month: { count: number; total: number };
  sale_this_month: { count: number; total: number };
  expense_this_month: { count: number; total: number };
  expense_by_category: ExpenseByCategory[];
  stock_by_location: Record<string, number>;
  stock_by_grade: Record<string, number>;
  top_fish_types: TopFishType[];
  valuation_by_location: ValuationByLocation[];
  top_ponds: TopPond[];
  trend_30_days: TrendDay[];
}

const GRADE_COLORS: Record<string, string> = {
  "Show Quality": "#f59e0b",
  "Grade A": "#10b981",
  "Grade B": "#8b5cf6",
};

export default function Dashboard() {
  const { data: raw, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () =>
      api
        .get<{ data: DashboardSummary }>("/v1/dashboard/summary")
        .then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  // Defensive: backend kadang kembalikan array kosong vs object kosong (PHP collection
  // serialization). Normalisasi semua field array/object di atomic state `safe` supaya
  // satu deploy lama-baru tidak crash di tengah transition (akses .length/.map aman).
  const safe = raw
    ? {
        ...raw,
        expense_by_category: Array.isArray(raw.expense_by_category) ? raw.expense_by_category : [],
        top_fish_types: Array.isArray(raw.top_fish_types) ? raw.top_fish_types : [],
        valuation_by_location: Array.isArray(raw.valuation_by_location) ? raw.valuation_by_location : [],
        top_ponds: Array.isArray(raw.top_ponds) ? raw.top_ponds : [],
        trend_30_days: Array.isArray(raw.trend_30_days) ? raw.trend_30_days : [],
        stock_by_location:
          raw.stock_by_location && typeof raw.stock_by_location === "object"
            ? raw.stock_by_location
            : {},
        stock_by_grade:
          raw.stock_by_grade && typeof raw.stock_by_grade === "object"
            ? raw.stock_by_grade
            : {},
        expense_this_month: raw.expense_this_month ?? { count: 0, total: 0 },
        purchase_this_month: raw.purchase_this_month ?? { count: 0, total: 0 },
        sale_this_month: raw.sale_this_month ?? { count: 0, total: 0 },
        total_active_stock: raw.total_active_stock ?? 0,
        unsorted_stock: raw.unsorted_stock ?? 0,
        total_valuation: raw.total_valuation ?? 0,
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beranda"
        description={`Ringkasan stok, pembelian, dan penjualan ${brand.name}`}
      />

      {isLoading || !safe ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatCard
              title="Total Stok Aktif"
              value={`${formatNumber(safe.total_active_stock)} ekor`}
              subtitle="Tersebar di seluruh kolam"
              icon={<Fish className="h-6 w-6" />}
              color="cyan"
            />
            <StatCard
              title="Estimasi Nilai Stok"
              value={formatRpShort(safe.total_valuation)}
              subtitle="Total ekor × harga/ekor"
              icon={<DollarSign className="h-6 w-6" />}
              color="emerald"
            />
            <StatCard
              title="Belum Disortir"
              value={`${formatNumber(safe.unsorted_stock)} ekor`}
              subtitle="Perlu sortir"
              icon={<AlertTriangle className="h-6 w-6" />}
              color="amber"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Pembelian Bulan Ini"
              value={formatRp(safe.purchase_this_month.total)}
              subtitle={`${safe.purchase_this_month.count} transaksi`}
              icon={<ShoppingCart className="h-6 w-6" />}
              color="violet"
            />
            <StatCard
              title="Penjualan Bulan Ini"
              value={formatRp(safe.sale_this_month.total)}
              subtitle={`${safe.sale_this_month.count} transaksi`}
              icon={<TrendingUp className="h-6 w-6" />}
              color="emerald"
            />
            <StatCard
              title="Pengeluaran Bulan Ini"
              value={formatRp(safe.expense_this_month.total)}
              subtitle={`${safe.expense_this_month.count} transaksi`}
              icon={<Wallet className="h-6 w-6" />}
              color="rose"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard className="lg:col-span-2" gradient="cyan">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">
                  Stok per Lokasi
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Distribusi total ekor di seluruh lokasi
                </p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(safe.stock_by_location).map(
                      ([name, total]) => ({ name, total })
                    )}
                  >
                    <defs>
                      <linearGradient
                        id="bar-gradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                        <stop
                          offset="100%"
                          stopColor="#3b82f6"
                          stopOpacity={0.5}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0 0 0 / 0.06)"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="currentColor"
                      fontSize={12}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      stroke="currentColor"
                      fontSize={12}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                      }}
                    />
                    <Bar
                      dataKey="total"
                      fill="url(#bar-gradient)"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard gradient="amber">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">
                  Stok per Grade
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Komposisi kualitas
                </p>
              </div>
              {Object.keys(safe.stock_by_grade).length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                  Belum ada batch terklasifikasi grade.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(safe.stock_by_grade).map(
                          ([name, value]) => ({ name, value })
                        )}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {Object.keys(safe.stock_by_grade).map((name) => (
                          <Cell
                            key={name}
                            fill={GRADE_COLORS[name] ?? "#64748b"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Trend 30 hari */}
          <GlassCard gradient="violet">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Pergerakan Stok 30 Hari
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Masuk (pembelian/panen) vs keluar (penjualan/mortality)
                </p>
              </div>
            </div>
            {safe.trend_30_days.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Belum ada pergerakan stok dalam 30 hari terakhir.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={safe.trend_30_days}>
                    <defs>
                      <linearGradient id="in-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="out-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 0.06)" />
                    <XAxis
                      dataKey="date"
                      stroke="currentColor"
                      fontSize={11}
                      tickFormatter={(d) => d?.slice(5) ?? ""}
                    />
                    <YAxis stroke="currentColor" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="in"
                      name="Masuk"
                      stroke="#10b981"
                      fill="url(#in-gradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="out"
                      name="Keluar"
                      stroke="#f43f5e"
                      fill="url(#out-gradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>

          {/* Top jenis + valuasi per lokasi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard gradient="emerald">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-foreground">
                  Top 5 Jenis Ikan
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Berdasarkan jumlah ekor aktif
                </p>
              </div>
              {safe.top_fish_types.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada safe.</div>
              ) : (
                <ul className="space-y-2">
                  {safe.top_fish_types.map((f, i) => (
                    <li
                      key={f.fish_type_id}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 p-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          #{i + 1}
                        </span>
                        <div>
                          <div className="font-medium">{f.name}</div>
                          <div className="text-[11px] text-muted-foreground capitalize">
                            {f.group}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold">
                          {formatNumber(f.total)} ekor
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {formatRpShort(f.value)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            <GlassCard gradient="cyan">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-foreground">
                  Valuasi per Lokasi
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Total nilai stok per lokasi farm
                </p>
              </div>
              {safe.valuation_by_location.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada safe.</div>
              ) : (
                <ul className="space-y-2">
                  {safe.valuation_by_location.map((l) => (
                    <li
                      key={l.location}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 p-2"
                    >
                      <div>
                        <div className="font-medium">{l.location}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {formatNumber(l.ekor)} ekor
                        </div>
                      </div>
                      <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatRpShort(l.value)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>

          {/* Pengeluaran bulan ini per kategori */}
          {safe.expense_by_category.length > 0 && (
            <GlassCard gradient="rose">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Pengeluaran Bulan Ini per Kategori
                  </h2>
                  <p className="text-[12px] text-muted-foreground">
                    Top 8 kategori dengan biaya terbesar
                  </p>
                </div>
                <span className="font-mono text-sm text-rose-600 dark:text-rose-400">
                  {formatRpShort(safe.expense_this_month.total)}
                </span>
              </div>
              <ul className="space-y-2">
                {safe.expense_by_category.map((c) => {
                  const pct =
                    safe.expense_this_month.total > 0
                      ? (c.total / safe.expense_this_month.total) * 100
                      : 0;
                  return (
                    <li key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium">{c.category}</span>
                        <span className="font-mono text-rose-600 dark:text-rose-400">
                          {formatRpShort(c.total)}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({pct.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-rose-500/10">
                        <div
                          className="h-full rounded-full bg-rose-500/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </GlassCard>
          )}

          {/* Top kolam */}
          <GlassCard gradient="amber">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-foreground">
                Top 5 Kolam (terpadat)
              </h2>
              <p className="text-[12px] text-muted-foreground">
                Kolam dengan ekor terbanyak — bantu prioritas opname
              </p>
            </div>
            {safe.top_ponds.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada kolam.</div>
            ) : (
              <ul className="space-y-2">
                {safe.top_ponds.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 p-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        #{i + 1}
                      </span>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.location ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono font-semibold">
                      {formatNumber(p.stock)} ekor
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
