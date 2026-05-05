import { useQuery } from "@tanstack/react-query";
import {
  Fish,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { api } from "@/api/client";
import { brand } from "@/config/brand";
import { GlassCard, StatCard, PageHeader } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRp, formatNumber } from "@/utils/format";
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
} from "recharts";

interface DashboardSummary {
  total_active_stock: number;
  unsorted_stock: number;
  purchase_this_month: { count: number; total: number };
  sale_this_month: { count: number; total: number };
  stock_by_location: Record<string, number>;
  stock_by_grade: Record<string, number>;
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Total Stok Aktif"
              value={`${formatNumber(data.total_active_stock)} ekor`}
              subtitle="Tersebar di seluruh kolam"
              icon={<Fish className="h-6 w-6" />}
              color="cyan"
            />
            <StatCard
              title="Belum Disortir"
              value={`${formatNumber(data.unsorted_stock)} ekor`}
              subtitle="Perlu sortir untuk ditentukan harga"
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
        </>
      )}
    </div>
  );
}
