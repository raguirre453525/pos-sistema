"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, ShoppingCart, DollarSign, BarChart3, Activity, RefreshCw } from "lucide-react";
import { getAdminMetrics, getBusinesses, type AdminMetricsDto, type AdminBusinessMetricsDto, type BusinessDto, ApiError } from "@/lib/api";
import { useAdminGuard } from "@/hooks/useAdminGuard";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("es-AR").format(n);
}

export default function MetricasPage() {
  const { allowed, loading: guardLoading } = useAdminGuard({ redirectTo: "/Ventas" });
  const [metrics, setMetrics] = useState<AdminMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BusinessDto[] | null>(null);
  const [bizLoading, setBizLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminMetrics();
      setMetrics(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar métricas";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBusinesses = useCallback(async () => {
    setBizLoading(true);
    try {
      const data = await getBusinesses();
      setBusinesses(data);
    } catch {
      setBusinesses([]);
    } finally {
      setBizLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchMetrics(), fetchBusinesses()]);
  }, [fetchMetrics, fetchBusinesses]);

  useEffect(() => {
    if (!allowed) return;
    void fetchAll();
  }, [allowed, fetchAll]);

  if (guardLoading) {
    return <main className="w-full p-6 text-sm text-muted-foreground">Cargando…</main>;
  }
  if (!allowed) {
    return <main className="w-full p-6 text-sm text-muted-foreground">Redirigiendo…</main>;
  }

  // Derive table rows: prefer metrics.businesses if present, else fallback to businesses + metrics aggregates
  const tableRows: AdminBusinessMetricsDto[] | null = (() => {
    if (metrics?.businesses && metrics.businesses.length > 0) {
      return metrics.businesses;
    }
    if (businesses && businesses.length > 0) {
      // fallback: show usersCount from Businesses, distribute totals if needed
      // if global totals exist and businesses exist, we could distribute proportionally but keep simple: show 0 for tickets/revenue if not in detailed businesses
      return businesses.map((b) => ({
        id: b.id,
        name: b.name,
        isActive: b.isActive,
        usersCount: b.usersCount ?? 0,
        totalSales: 0,
        totalRevenue: 0,
      }));
    }
    if (businesses && businesses.length === 0) return [];
    return null;
  })();

  const isTableLoading = loading || bizLoading;

  return (
    <main className="w-full min-w-full max-w-none p-4 md:p-6 flex flex-col gap-6 bg-background text-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Métricas Globales
          </h1>
          <p className="text-sm text-muted-foreground">Vista consolidada de la plataforma — solo SuperAdmin</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchAll()}
          disabled={loading || bizLoading}
          className="h-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 gap-1.5 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar datos
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-white dark:bg-card border border-slate-200/80 rounded-xl p-5 shadow-sm animate-pulse">
              <div className="h-4 bg-slate-100 dark:bg-muted rounded w-1/2 mb-4" />
              <div className="h-8 bg-slate-100 dark:bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 dark:bg-muted rounded w-2/3" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex flex-col gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchAll()} className="self-start">Reintentar</Button>
          </CardContent>
        </Card>
      ) : metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Total Comercios */}
          <Card className="bg-white dark:bg-card border border-slate-200/80 rounded-xl p-5 shadow-sm">
            <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-muted-foreground">Total Comercios</CardTitle>
              <Building2 className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="p-0 flex flex-col gap-1">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground tabular-nums">{fmtInt(metrics.totalBusinesses)}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                Activos: <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border px-1.5 py-0 text-xs">{fmtInt(metrics.activeBusinesses)}</Badge> ·
                Inactivos: <Badge variant="secondary" className="px-1.5 py-0 text-xs">{fmtInt(metrics.inactiveBusinesses)}</Badge>
              </span>
              <span className="text-xs text-muted-foreground">Registrados en plataforma</span>
            </CardContent>
          </Card>

          {/* Card 2: Total Usuarios */}
          <Card className="bg-white dark:bg-card border border-slate-200/80 rounded-xl p-5 shadow-sm">
            <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-muted-foreground">Total Usuarios</CardTitle>
              <Users className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="p-0 flex flex-col gap-1">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground tabular-nums">{fmtInt(metrics.totalUsers)}</span>
              <span className="text-xs text-muted-foreground">En plataforma</span>
            </CardContent>
          </Card>

          {/* Card 3: Total Ventas */}
          <Card className="bg-white dark:bg-card border border-slate-200/80 rounded-xl p-5 shadow-sm">
            <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-muted-foreground">Ventas Globales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="p-0 flex flex-col gap-1">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground tabular-nums">{fmtInt(metrics.totalSales)}</span>
              <span className="text-xs text-muted-foreground">Total Transacciones</span>
            </CardContent>
          </Card>

          {/* Card 4: Monto Total Facturado */}
          <Card className="bg-white dark:bg-card border border-slate-200/80 rounded-xl p-5 shadow-sm">
            <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-muted-foreground">Monto Facturado</CardTitle>
              <DollarSign className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="p-0 flex flex-col gap-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground font-mono tabular-nums">{fmtMoney(metrics.totalRevenue)}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> Histórico acumulado</span>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Resumen de actividad por comercio */}
      <div className="bg-white dark:bg-card border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resumen de actividad por comercio</h2>
          <span className="text-xs text-muted-foreground">{tableRows ? `${tableRows.length} comercios` : "—"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-muted/40 border-b border-slate-200 dark:border-border text-xs text-slate-500 dark:text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Nombre del negocio</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-right px-4 py-3 font-semibold">Total usuarios</th>
                <th className="text-right px-4 py-3 font-semibold">Total tickets</th>
                <th className="text-right px-4 py-3 font-semibold">Facturación acumulada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-border">
              {isTableLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="h-11 animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-muted rounded w-32" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 dark:bg-muted rounded-full w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-muted rounded w-12 ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-muted rounded w-12 ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-muted rounded w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : !tableRows || tableRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin comercios registrados</td>
                </tr>
              ) : (
                tableRows.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 h-11">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-foreground">{b.name}</td>
                    <td className="px-4 py-3">
                      {b.isActive ? (
                        <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full">Activo</span>
                      ) : (
                        <span className="inline-flex items-center bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold px-2.5 py-1 rounded-full">Inactivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtInt(b.usersCount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtInt(b.totalSales)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtMoney(b.totalRevenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
