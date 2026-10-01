"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, Package, TrendingUp } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/Reusables/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFeatureGuard } from "@/hooks/useFeatureGuard";
import { ApiError, getLowStock, getSalesReport, getStockAudits } from "@/lib/api";
import type { LowStockDto, PagedResult, SaleDto, StockAuditDto } from "@/lib/api";

type Tab = "low-stock" | "sales" | "audits";

const lowStockColumns: ColumnDef<LowStockDto>[] = [
  { accessorKey: "sku", header: "SKU", cell: ({ row }) => <span className="font-medium">{row.original.sku}</span> },
  { accessorKey: "name", header: "Producto", cell: ({ row }) => <span>{row.original.name}</span> },
  { accessorKey: "stock", header: "Stock", cell: ({ row }) => <span className={row.original.stock === 0 ? "font-semibold text-red-600" : "font-medium"}>{row.original.stock}</span> },
  { accessorKey: "price", header: "Precio", cell: ({ row }) => <span>${Number(row.original.price).toLocaleString("es-AR")}</span> },
  { accessorKey: "threshold", header: "Umbral", cell: ({ row }) => <span>{row.original.threshold}</span> },
];

const salesColumns: ColumnDef<SaleDto>[] = [
  { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id.slice(0, 8)}</span> },
  { accessorKey: "date", header: "Fecha", cell: ({ row }) => <span>{new Date(row.original.date).toLocaleString("es-AR")}</span> },
  { accessorKey: "paymentMethod", header: "Pago", cell: ({ row }) => <span>{row.original.paymentMethod}</span> },
  { accessorKey: "total", header: "Total", cell: ({ row }) => <span className="font-medium">${Number(row.original.total).toLocaleString("es-AR")}</span> },
  {
    id: "items",
    header: "Items",
    cell: ({ row }) => {
      const sale = row.original;
      const combos = sale.salePromotions?.map((promotion) => `${promotion.promotionName} x${promotion.quantity} ($${promotion.unitPrice.toLocaleString("es-AR")})`).join(" | ");
      const items = sale.items.map((item) => `${item.name} x${item.quantity}${item.isFromCombo ? " (combo)" : ""}`).join(", ");
      return <span className="text-xs">{combos && <span className="mr-1 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5">{combos}</span>}{items}</span>;
    },
  },
  {
    id: "combos",
    header: "Combos",
    cell: ({ row }) => {
      const promotions = row.original.salePromotions;
      if (!promotions?.length) return <span className="text-xs text-muted-foreground">—</span>;
      return <span className="text-xs">{promotions.map((promotion) => `${promotion.promotionName} ×${promotion.quantity} — $${promotion.totalPaid.toLocaleString("es-AR")} (ahorro $${promotion.saving.toLocaleString("es-AR")})`).join("; ")}</span>;
    },
  },
];

const auditColumns: ColumnDef<StockAuditDto>[] = [
  { accessorKey: "sku", header: "SKU", cell: ({ row }) => <span className="font-medium">{row.original.sku}</span> },
  { accessorKey: "productName", header: "Producto", cell: ({ row }) => <span>{row.original.productName}</span> },
  { accessorKey: "delta", header: "Delta", cell: ({ row }) => <span className={row.original.delta > 0 ? "text-green-600" : "text-red-600"}>{row.original.delta > 0 ? `+${row.original.delta}` : row.original.delta}</span> },
  { accessorKey: "resultingStock", header: "Stock result.", cell: ({ row }) => <span>{row.original.resultingStock}</span> },
  { accessorKey: "reason", header: "Motivo", cell: ({ row }) => <span className="inline-block max-w-[200px] truncate">{row.original.reason}</span> },
  { accessorKey: "adjustedAt", header: "Fecha", cell: ({ row }) => <span>{new Date(row.original.adjustedAt).toLocaleString("es-AR")}</span> },
];

const responsiveTableClass = "min-w-0 max-w-full [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11 [&_.overflow-hidden~div]:flex-col [&_.overflow-hidden~div]:items-stretch [&_.overflow-hidden~div]:gap-3 [&_.overflow-hidden~div>div:last-child]:flex-wrap [&_.overflow-hidden~div>div:last-child]:justify-between [&_.overflow-hidden~div>div:last-child]:gap-2 [&_.overflow-hidden~div>div:last-child]:space-x-0 [&_.overflow-hidden~div>div:last-child>div:first-child]:hidden sm:[&_.overflow-hidden~div]:flex-row sm:[&_.overflow-hidden~div]:items-center sm:[&_.overflow-hidden~div>div:last-child>div:first-child]:flex";

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : "Error";
}

export default function ReportesPage() {
  const { allowed } = useFeatureGuard({ requireReportes: true, denyRoles: ["User"] });
  const [tab, setTab] = useState<Tab>("low-stock");
  const [threshold, setThreshold] = useState("5");
  const [lowStock, setLowStock] = useState<LowStockDto[]>([]);
  const [lowLoading, setLowLoading] = useState(false);
  const [lowError, setLowError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pm, setPm] = useState<"" | "0" | "1" | "2">("");
  const [sales, setSales] = useState<PagedResult<SaleDto> | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [auditReason, setAuditReason] = useState("");
  const [audits, setAudits] = useState<PagedResult<StockAuditDto> | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchLow = useCallback(async () => {
    setLowLoading(true);
    setLowError(null);
    try {
      const value = Number(threshold);
      if (!Number.isInteger(value) || value < 0 || value > 1000) throw new Error("El umbral debe ser un número entero entre 0 y 1000.");
      setLowStock(await getLowStock(value));
    } catch (error) {
      setLowError(errorMessage(error));
    } finally {
      setLowLoading(false);
    }
  }, [threshold]);

  const fetchSales = useCallback(async (page = 1) => {
    setSalesError(null);
    if (from && to && from > to) {
      setSalesError("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }
    setSalesLoading(true);
    try {
      const data = await getSalesReport({
        from: from || undefined,
        to: to || undefined,
        paymentMethod: pm === "" ? undefined : (Number(pm) as 0 | 1 | 2),
        page,
        pageSize: 10,
      });
      setSales(data);
      setSalesPage(page);
    } catch (error) {
      setSalesError(errorMessage(error));
    } finally {
      setSalesLoading(false);
    }
  }, [from, to, pm]);

  const fetchAudits = useCallback(async (page = 1) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const data = await getStockAudits({ reasonContains: auditReason || undefined, page, pageSize: 10 });
      setAudits(data);
      setAuditPage(page);
    } catch (error) {
      setAuditError(errorMessage(error));
    } finally {
      setAuditLoading(false);
    }
  }, [auditReason]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === "low-stock") void fetchLow();
      if (tab === "sales") void fetchSales(1);
      if (tab === "audits") void fetchAudits(1);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const totalIncome = sales?.items.reduce((sum, sale) => sum + Number(sale.total), 0) ?? 0;
  const totalItems = sales?.items.reduce((sum, sale) => sum + sale.items.reduce((quantity, item) => quantity + item.quantity, 0), 0) ?? 0;
  const tableWidthClass = tab === "sales" ? "[&_table]:min-w-[900px]" : tab === "audits" ? "[&_table]:min-w-[800px]" : "[&_table]:min-w-[640px]";
  const panelId = `report-panel-${tab}`;

  if (!allowed) {
    return <main className="flex w-full min-w-0 max-w-none flex-col gap-6 bg-background p-4 text-foreground"><p className="text-sm text-muted-foreground">Redirigiendo…</p></main>;
  }

  return (
    <main className="flex w-full min-w-0 max-w-none flex-col gap-5 bg-background p-4 text-foreground sm:gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">REPORTES</h1>
        <p className="text-sm text-muted-foreground">Consultá ventas, niveles de stock y movimientos del inventario.</p>
      </header>

      <nav aria-label="Tipo de reporte" className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-1">
        {([
          ["low-stock", "Bajo stock"],
          ["sales", "Ventas"],
          ["audits", "Auditoría stock"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={tab === value ? "default" : "ghost"}
            aria-pressed={tab === value}
            aria-controls={panelId}
            className="min-h-11 min-w-0 whitespace-normal px-2 text-xs sm:text-sm"
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </nav>

      {tab === "low-stock" && (
        <section id={panelId} aria-label="Reporte de productos con bajo stock" className="flex min-w-0 flex-col gap-4">
          <form onSubmit={(event) => { event.preventDefault(); void fetchLow(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="stock-threshold" className="text-sm font-medium">Umbral de stock (0–1000)</label>
              <Input id="stock-threshold" type="number" inputMode="numeric" min={0} max={1000} step={1} value={threshold} onChange={(event) => setThreshold(event.target.value)} className="min-h-11 w-full sm:max-w-48" />
            </div>
            <Button type="submit" disabled={lowLoading} className="min-h-11 w-full sm:w-auto">{lowLoading ? "Cargando…" : "Buscar"}</Button>
            {lowError && <p role="alert" className="break-words text-sm text-red-600 sm:max-w-sm">{lowError}</p>}
          </form>

          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Productos con stock ≤ umbral</h2>
                <p className="text-sm text-muted-foreground">{lowStock.length} producto(s) encontrados</p>
              </div>
            </div>
            {lowLoading ? <p className="py-8 text-center text-sm text-muted-foreground" role="status">Cargando productos…</p> : (
              <div className={`${responsiveTableClass} ${tableWidthClass}`}>
                <DataTable columns={lowStockColumns} data={lowStock} label="Producto" placeholder="Buscar producto…" />
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "sales" && (
        <section id={panelId} aria-label="Reporte de ventas" className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Ventas encontradas", value: (sales?.totalCount ?? 0).toLocaleString("es-AR"), Icon: DollarSign, className: "" },
              { label: "Ingresos de esta página", value: `$${totalIncome.toLocaleString("es-AR")}`, Icon: TrendingUp, className: "" },
              { label: "Unidades en esta página", value: totalItems.toLocaleString("es-AR"), Icon: Package, className: "col-span-2 sm:col-span-1" },
            ].map(({ label, value, Icon, className }) => (
              <article key={label} className={`min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 ${className}`}>
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 pr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground"><Icon aria-hidden="true" className="size-5" /></span>
                </div>
                <p className="mt-2 whitespace-nowrap text-base font-semibold tabular-nums sm:text-xl lg:text-2xl">{value}</p>
              </article>
            ))}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void fetchSales(1); }} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="sales-from" className="text-sm font-medium">Desde</label>
              <Input id="sales-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-11 w-full" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="sales-to" className="text-sm font-medium">Hasta</label>
              <Input id="sales-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-h-11 w-full" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="sales-payment" className="text-sm font-medium">Medio de pago</label>
              <select id="sales-payment" value={pm} onChange={(event) => setPm(event.target.value as "" | "0" | "1" | "2")} className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <option value="">Todos</option>
                <option value="0">Efectivo</option>
                <option value="1">MercadoPago</option>
                <option value="2">Tarjeta</option>
              </select>
            </div>
            <Button type="submit" disabled={salesLoading} className="min-h-11 w-full">{salesLoading ? "Cargando…" : "Aplicar filtros"}</Button>
            {salesError && <p role="alert" className="break-words text-sm text-red-600 sm:col-span-2 lg:col-span-4">{salesError}</p>}
          </form>

          <section aria-labelledby="sales-table-title" className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="sales-table-title" className="text-lg font-semibold">Ventas{sales ? ` (${sales.totalCount})` : ""}</h2>
                <p className="text-sm text-muted-foreground">Página {sales?.page ?? salesPage} · hasta 10 ventas por página</p>
              </div>
            </div>
            {salesLoading ? <p className="py-8 text-center text-sm text-muted-foreground" role="status">Cargando ventas…</p> : (
              <div className={`${responsiveTableClass} ${tableWidthClass}`}>
                <DataTable columns={salesColumns} data={sales?.items ?? []} label="Venta" placeholder="Buscar venta…" />
              </div>
            )}
            {sales && sales.totalCount > sales.pageSize && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" variant="outline" disabled={salesPage <= 1 || salesLoading} onClick={() => void fetchSales(salesPage - 1)} className="min-h-11">Anterior</Button>
                <span className="px-2 text-sm tabular-nums">Pág. {sales.page} de {Math.ceil(sales.totalCount / sales.pageSize)}</span>
                <Button type="button" variant="outline" disabled={sales.page * sales.pageSize >= sales.totalCount || salesLoading} onClick={() => void fetchSales(salesPage + 1)} className="min-h-11">Siguiente</Button>
              </div>
            )}
          </section>
        </section>
      )}

      {tab === "audits" && (
        <section id={panelId} aria-label="Reporte de auditoría de stock" className="flex min-w-0 flex-col gap-4">
          <form onSubmit={(event) => { event.preventDefault(); void fetchAudits(1); }} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="audit-reason" className="text-sm font-medium">Filtrar por motivo</label>
              <Input id="audit-reason" value={auditReason} onChange={(event) => setAuditReason(event.target.value)} placeholder="Ej.: venta, inicial" className="min-h-11 w-full" />
            </div>
            <Button type="submit" disabled={auditLoading} className="min-h-11 w-full sm:w-auto">{auditLoading ? "Cargando…" : "Buscar"}</Button>
            {auditError && <p role="alert" className="break-words text-sm text-red-600 sm:col-span-2">{auditError}</p>}
          </form>

          <section aria-labelledby="audit-table-title" className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="audit-table-title" className="text-lg font-semibold">Auditoría de stock{audits ? ` (${audits.totalCount})` : ""}</h2>
                <p className="text-sm text-muted-foreground">Página {audits?.page ?? auditPage} · hasta 10 movimientos por página</p>
              </div>
            </div>
            {auditLoading ? <p className="py-8 text-center text-sm text-muted-foreground" role="status">Cargando auditoría…</p> : (
              <div className={`${responsiveTableClass} ${tableWidthClass}`}>
                <DataTable columns={auditColumns} data={audits?.items ?? []} label="Auditoría" placeholder="Buscar movimiento…" />
              </div>
            )}
            {audits && audits.totalCount > audits.pageSize && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" variant="outline" disabled={auditPage <= 1 || auditLoading} onClick={() => void fetchAudits(auditPage - 1)} className="min-h-11">Anterior</Button>
                <span className="px-2 text-sm tabular-nums">Pág. {audits.page} de {Math.ceil(audits.totalCount / audits.pageSize)}</span>
                <Button type="button" variant="outline" disabled={audits.page * audits.pageSize >= audits.totalCount || auditLoading} onClick={() => void fetchAudits(auditPage + 1)} className="min-h-11">Siguiente</Button>
              </div>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
