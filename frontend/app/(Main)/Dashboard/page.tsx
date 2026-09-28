"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, DollarSign, Package, CreditCard } from "lucide-react";
import StatCard from "@/components/Dashboard/StatCard";
import { getDashboard, DashboardSummaryDto, ApiError } from "@/lib/api";
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart, Pie, Cell, ResponsiveContainer as PieResponsiveContainer, Tooltip as PieTooltip } from "recharts";
import { useFeatureGuard } from "@/hooks/useFeatureGuard";

type RangeKey = "today" | "7d" | "30d" | "month" | "custom";

const PIE_COLORS = ["#ef4444", "#000000", "#ec5430", "#f59e0b", "#fffb04"];

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getRangeDates(range: RangeKey, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  const todayStr = toISODate(today);
  if (range === "today") return { from: todayStr, to: todayStr };
  if (range === "7d") {
    const f = new Date(today);
    f.setDate(today.getDate() - 6);
    return { from: toISODate(f), to: todayStr };
  }
  if (range === "30d") {
    const f = new Date(today);
    f.setDate(today.getDate() - 29);
    return { from: toISODate(f), to: todayStr };
  }
  if (range === "month") {
    const f = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toISODate(f), to: todayStr };
  }
  // custom
  return { from: customFrom, to: customTo };
}

export default function Page() {
  const router = useRouter();
  const { allowed } = useFeatureGuard({ requireReportes: true, denyRoles: ["User"] });
  const [range, setRange] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState(toISODate(new Date()));
  const [customTo, setCustomTo] = useState(toISODate(new Date()));
  const [data, setData] = useState<DashboardSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => getRangeDates(range, customFrom, customTo), [range, customFrom, customTo]);

  // For custom range, don't auto-fetch until Aplicar; but for simplicity fetch when from/to valid and range != custom OR custom has both dates
  const canFetch = useMemo(() => {
    if (range !== "custom") return true;
    return Boolean(customFrom && customTo);
  }, [range, customFrom, customTo]);

  const fetchDashboard = useCallback(async () => {
    if (!canFetch) return;
    // validate custom range
    if (range === "custom" && customFrom && customTo && customFrom > customTo) {
      setError("La fecha desde no puede ser mayor que hasta");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard({ from, to });
      setData(res);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar dashboard";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [from, to, canFetch, range, customFrom, customTo]);

  useEffect(() => {
    if (range !== "custom") {
      fetchDashboard();
    }
  }, [fetchDashboard, range]);

  // Initial fetch
  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isToday = range === "today";
  const salesTitle = isToday ? "Ventas de hoy" : "Ventas del período";

  const barData = useMemo(() => {
    if (!data?.dailySales) return [];
    return data.dailySales.map((d) => {
      const dt = new Date(d.date);
      const label = dt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
      return { name: label, total: d.total, count: d.count, dateRaw: d.date };
    });
  }, [data]);

  const pieData = useMemo(() => {
    if (!data?.salesByCategory) return [];
    return data.salesByCategory.map((c) => ({ category: c.category, value: c.total, quantity: c.quantity }));
  }, [data]);

  const hasBarData = barData.some((b) => b.total > 0 || b.count > 0);
  const hasPieData = pieData.length > 0 && pieData.some((p) => p.value > 0);

  const reportLink = `/Reportes?from=${from}&to=${to}`;

  if (!allowed) {
    return (
      <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Redirigiendo…</p>
      </main>
    );
  }

  const pills: { key: RangeKey; label: string }[] = [
    { key: "today", label: "Hoy" },
    { key: "7d", label: "7 días" },
    { key: "30d", label: "30 días" },
    { key: "month", label: "Este mes" },
    { key: "custom", label: "Rango personalizado" },
  ];

  return (
    <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>

      {/* Global filter */}
      <div className="flex flex-wrap gap-2 items-center">
        {pills.map((p) => (
          <button
            key={p.key}
            onClick={() => setRange(p.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              range === p.key ? "bg-red-500 text-white border-red-500" : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap gap-3 items-end bg-card p-4 rounded-xl border border-border">
          <div>
            <label className="text-sm font-medium">Desde</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm bg-card ml-2" />
          </div>
          <div>
            <label className="text-sm font-medium">Hasta</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm bg-card ml-2" />
          </div>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600"
          >
            Aplicar
          </button>
          <span className="text-xs text-muted-foreground">Rango: {from} → {to}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={fetchDashboard} className="text-sm font-medium underline">Reintentar</button>
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card p-6 rounded-xl border border-border shadow-sm animate-pulse h-28">
              <div className="h-4 bg-muted rounded w-1/2 mb-3" />
              <div className="h-6 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href={reportLink} className="block">
            <StatCard title={salesTitle} value={String(data.salesCount)} icon={ShoppingBag} color="bg-card-100 text-black-600 border border-border" />
          </Link>
          <Link href={reportLink} className="block">
            <StatCard title="Total facturado" value={`$${Number(data.totalRevenue).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`} icon={DollarSign} color="bg-card-100 text-black-600 border border-border" />
          </Link>
          <Link href={reportLink} className="block">
            <StatCard title="Productos vendidos" value={String(data.productsSoldQuantity)} icon={Package} color="bg-card-100 text-black-600 border border-border" />
          </Link>
          <Link href={reportLink} className="block">
            <StatCard title="Ticket promedio" value={`$${Number(data.ticketAverage).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`} icon={CreditCard} color="bg-card-100 text-black-600 border border-border" />
          </Link>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-6 min-h-[380px]">
          <h3 className="text-lg font-semibold mb-4 text-foreground">VENTAS POR DÍA</h3>
          {loading ? (
            <div className="h-[300px] animate-pulse bg-muted rounded-xl" />
          ) : !hasBarData ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-xl">Sin ventas en este período</div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{ borderRadius: "8px", border: "none", backgroundColor: "var(--background)", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ color: "var(--foreground)", fontSize: "14px", fontWeight: "bold" }}
                    labelStyle={{ color: "#ef4444", fontSize: "12px" }}
                    formatter={(value: any, _name: any, props: any) => [`$${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2 })} (${props?.payload?.count ?? 0} ventas)`, "Total"]}
                  />
                  <Bar dataKey="total" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 bg-card rounded-xl border border-border shadow-sm p-6 min-h-[380px]">
          <h3 className="text-lg font-semibold mb-4 text-foreground text-center">VENTAS POR CATEGORÍA</h3>
          {loading ? (
            <div className="h-[300px] animate-pulse bg-muted rounded-xl" />
          ) : !hasPieData ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-xl">Sin datos</div>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center">
              <PieResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <PieTooltip
                    contentStyle={{ borderRadius: "8px", border: "none", backgroundColor: "var(--background)", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ color: "var(--foreground)", fontSize: "14px", fontWeight: "bold" }}
                    labelStyle={{ color: "#ef4444", fontSize: "12px" }}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    stroke="var(--background)"
                    strokeWidth={5}
                    paddingAngle={5}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </PieResponsiveContainer>
            </div>
          )}
          {hasPieData && (
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {pieData.map((c, i) => (
                <span key={c.category} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {c.category}: ${Number(c.value).toLocaleString("es-AR", { minimumFractionDigits: 2 })} ({c.quantity}u)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ranking + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">RANKING TOP 5 PRODUCTOS</h3>
          {loading ? (
            <div className="h-40 animate-pulse bg-muted rounded-xl" />
          ) : !data || data.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center border border-dashed rounded-xl">Sin ventas</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 font-medium">Producto</th>
                    <th className="py-2 font-medium">Cantidad</th>
                    <th className="py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.productId} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="font-medium truncate max-w-[220px]">{p.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                      </td>
                      <td className="py-3 font-medium">{p.quantity}</td>
                      <td className="py-3">${Number(p.revenue).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">ÚLTIMAS VENTAS</h3>
          {loading ? (
            <div className="h-40 animate-pulse bg-muted rounded-xl" />
          ) : !data || data.recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center border border-dashed rounded-xl">Sin ventas</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between border border-border rounded-xl px-4 py-3 bg-background">
                  <div>
                    <div className="text-sm font-medium">{new Date(s.date).toLocaleDateString("es-AR")} {new Date(s.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="text-xs text-muted-foreground font-mono">{s.id.slice(0, 8)} · {s.paymentMethod} · {s.items.reduce((a, i) => a + i.quantity, 0)} items</div>
                  </div>
                  <div className="text-sm font-semibold">${Number(s.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}




