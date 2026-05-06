import { useQuery } from "@tanstack/react-query";
import {
  Fish,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  DollarSign,
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

interface DashboardSummary {
  total_active_stock: number;
  unsorted_stock: number;
  total_valuation: number;
  purchase_this_month: { count: number; total: number };
  sale_this_month: { count: number; total: number };
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
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () =>
      api
        .get<{ data: DashboardSummary }>("/v1/dashboard/summary")
        .then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beranda"
        description={`Ringkasan stok, pembelian, dan penjualan ${brand.name}`}
      />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <StatCard
              title="Total Stok Aktif"
              value={`${formatNumber(data.total_active_stock)} ekor`}
              subtitle="Tersebar di seluruh kolam"
              icon={<Fish className="h-6 w-6" />}
              color="cyan"
            />
            <StatCard
              title="Estimasi Nilai Stok"
              value={formatRpShort(data.total_valuation)}
              subtitle="Total ekor × harga/ekor"
              icon={<DollarSign className="h-6 w-6" />}
              color="emerald"
            />
            <StatCard
              title="Belum Disortir"
              value={`${formatNumber(data.unsorted_stock)} ekor`}
              subtitle="Perlu sortir"
              icon={<AlertTriangle className="h-6 w-6" />}
              color="amber"
            />
            <StatCard
              title="Pembelian Bulan Ini"
              value={formatRp(data.purchase_this_month.total)}
              subtitle={`${data.purchase_this_month.count} transaksi`}
              icon={<ShoppingCart className="h-6 w-6" />}
              color="violet"
            />
            <StatCard
              title="Penjualan Bulan Ini"
              value={formatRp(data.sale_this_month.total)}
              subtitle={`${data.sale_this_month.count} transaksi`}
              icon={<TrendingUp className="h-6 w-6" />}
              color="emerald"
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
                    data={Object.entries(data.stock_by_location).map(
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
              {Object.keys(data.stock_by_grade).length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                  Belum ada batch terklasifikasi grade.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.stock_by_grade).map(
                          ([name, value]) => ({ name, value })
                        )}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {Object.keys(data.stock_by_grade).map((name) => (
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
            {data.trend_30_days.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Belum ada pergerakan stok dalam 30 hari terakhir.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend_30_days}>
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
              {data.top_fish_types.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada data.</div>
              ) : (
                <ul className="space-y-2">
                  {data.top_fish_types.map((f, i) => (
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
              {data.valuation_by_location.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada data.</div>
              ) : (
                <ul className="space-y-2">
                  {data.valuation_by_location.map((l) => (
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
            {data.top_ponds.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada kolam.</div>
            ) : (
              <ul className="space-y-2">
                {data.top_ponds.map((p, i) => (
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
