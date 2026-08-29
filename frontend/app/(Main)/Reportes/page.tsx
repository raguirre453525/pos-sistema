"use client";
import { useEffect, useState, useCallback } from "react";
import { DollarSign, TrendingUp, Package } from "lucide-react";
import StatCard from "@/components/Dashboard/StatCard";
import DataTable from "@/components/Reusables/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLowStock,
  getSalesReport,
  getStockAudits,
  LowStockDto,
  StockAuditDto,
  SaleDto,
  PagedResult,
  ApiError,
} from "@/lib/api";
import { ColumnDef } from "@tanstack/react-table";

type Tab = "low-stock" | "sales" | "audits";

const lowStockColumns: ColumnDef<LowStockDto>[] = [
  { accessorKey: "sku", header: "SKU", cell: ({ row }) => <span className="font-medium">{row.original.sku}</span> },
  { accessorKey: "name", header: "Producto", cell: ({ row }) => <span>{row.original.name}</span> },
  { accessorKey: "stock", header: "Stock", cell: ({ row }) => <span className={row.original.stock === 0 ? "text-red-600 font-bold" : "font-medium"}>{row.original.stock}</span> },
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
      const s = row.original;
      const combos = s.salePromotions?.map(sp => `${sp.promotionName} x${sp.quantity} ($${sp.unitPrice.toLocaleString("es-AR")})`).join(" | ");
      const itemsStr = s.items.map((i) => `${i.name} x${i.quantity}${i.isFromCombo ? " (combo)" : ""}`).join(", ");
      return (
        <span className="text-xs">
          {combos && <span className="bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 mr-1">{combos}</span>}
          {itemsStr}
        </span>
      );
    },
  },
  {
    id: "combos",
    header: "Combos",
    cell: ({ row }) => {
      const sps = row.original.salePromotions;
      if (!sps || sps.length===0) return <span className="text-muted-foreground text-xs">—</span>;
      return <span className="text-xs">{sps.map(sp=>`${sp.promotionName} ×${sp.quantity} — $${sp.totalPaid.toLocaleString("es-AR")} (ahorro $${sp.saving.toLocaleString("es-AR")})`).join("; ")}</span>;
    }
  },
];

const auditColumns: ColumnDef<StockAuditDto>[] = [
  { accessorKey: "sku", header: "SKU", cell: ({ row }) => <span className="font-medium">{row.original.sku}</span> },
  { accessorKey: "productName", header: "Producto", cell: ({ row }) => <span>{row.original.productName}</span> },
  { accessorKey: "delta", header: "Delta", cell: ({ row }) => <span className={row.original.delta > 0 ? "text-green-600" : "text-red-600"}>{row.original.delta > 0 ? `+${row.original.delta}` : row.original.delta}</span> },
  { accessorKey: "resultingStock", header: "Stock result.", cell: ({ row }) => <span>{row.original.resultingStock}</span> },
  { accessorKey: "reason", header: "Motivo", cell: ({ row }) => <span className="truncate max-w-[200px] inline-block">{row.original.reason}</span> },
  { accessorKey: "adjustedAt", header: "Fecha", cell: ({ row }) => <span>{new Date(row.original.adjustedAt).toLocaleString("es-AR")}</span> },
];

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>("low-stock");

  // low-stock
  const [threshold, setThreshold] = useState("5");
  const [lowStock, setLowStock] = useState<LowStockDto[]>([]);
  const [lowLoading, setLowLoading] = useState(false);
  const [lowError, setLowError] = useState<string | null>(null);

  // sales
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pm, setPm] = useState<"" | "0" | "1">("");
  const [sales, setSales] = useState<PagedResult<SaleDto> | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  // audits
  const [auditReason, setAuditReason] = useState("");
  const [audits, setAudits] = useState<PagedResult<StockAuditDto> | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchLow = useCallback(async () => {
    setLowLoading(true);
    setLowError(null);
    try {
      const t = parseInt(threshold, 10);
      if (isNaN(t) || t < 0 || t > 1000) throw new Error("Threshold debe estar entre 0 y 1000");
      const data = await getLowStock(t);
      setLowStock(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error";
      setLowError(msg);
    } finally {
      setLowLoading(false);
    }
  }, [threshold]);

  const fetchSales = useCallback(async (page = 1) => {
    setSalesLoading(true);
    setSalesError(null);
    try {
      const data = await getSalesReport({
        from: from || undefined,
        to: to || undefined,
        paymentMethod: pm === "" ? undefined : (Number(pm) as 0 | 1),
        page,
        pageSize: 10,
      });
      setSales(data);
      setSalesPage(page);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error";
      setSalesError(msg);
    } finally {
      setSalesLoading(false);
    }
  }, [from, to, pm]);

  const fetchAudits = useCallback(async (page = 1) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const data = await getStockAudits({
        reasonContains: auditReason || undefined,
        page,
        pageSize: 10,
      });
      setAudits(data);
      setAuditPage(page);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error";
      setAuditError(msg);
    } finally {
      setAuditLoading(false);
    }
  }, [auditReason]);

  useEffect(() => {
    if (tab === "low-stock") fetchLow();
    if (tab === "sales") fetchSales(1);
    if (tab === "audits") fetchAudits(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const totalSales = sales?.totalCount ?? 0;
  const totalIncome = sales?.items.reduce((a, s) => a + Number(s.total), 0) ?? 0;
  const totalItems = sales?.items.reduce((a, s) => a + s.items.reduce((x, i) => x + i.quantity, 0), 0) ?? 0;

  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-foreground text-2xl">REPORTES</h1>

      <div className="flex gap-2">
        <Button variant={tab === "low-stock" ? "default" : "outline"} onClick={() => setTab("low-stock")}>Bajo stock</Button>
        <Button variant={tab === "sales" ? "default" : "outline"} onClick={() => setTab("sales")}>Ventas</Button>
        <Button variant={tab === "audits" ? "default" : "outline"} onClick={() => setTab("audits")}>Auditoría stock</Button>
      </div>

      {tab === "low-stock" && (
        <>
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-sm font-medium">Umbral (0..1000)</label>
              <Input type="number" min={0} max={1000} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-32" />
            </div>
            <Button onClick={fetchLow} disabled={lowLoading}>{lowLoading ? "Cargando…" : "Buscar"}</Button>
            {lowError && <span className="text-sm text-red-600">{lowError}</span>}
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Productos con stock ≤ umbral</h3>
            {lowLoading ? <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p> : <DataTable columns={lowStockColumns} data={lowStock} label="Producto" placeholder="Buscar…" />}
          </div>
        </>
      )}

      {tab === "sales" && (
        <>
          <div className="flex flex-col md:flex-row gap-6">
            <StatCard title="Ventas Totales" value={totalSales.toString()} icon={DollarSign} color="bg-white-100 text-black-600 border border-gray-200" />
            <StatCard title="Ingresos Totales" value={`$${totalIncome.toLocaleString("es-AR")}`} icon={TrendingUp} color="bg-white-100 text-black-600 border border-gray-200" />
            <StatCard title="Productos Vendidos" value={totalItems.toString()} icon={Package} color="bg-white-100 text-black-600 border border-gray-200" />
          </div>
          <div className="flex flex-wrap gap-3 items-end bg-card p-4 rounded-xl border border-border">
            <div><label className="text-sm">Desde</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="text-sm">Hasta</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div>
              <label className="text-sm">Pago</label>
              <select value={pm} onChange={(e) => setPm(e.target.value as "" | "0" | "1")} className="border border-input rounded-lg px-3 py-1.5 text-sm bg-card h-8">
                <option value="">Todos</option><option value="0">Efectivo</option><option value="1">MercadoPago</option>
              </select>
            </div>
            <Button onClick={() => fetchSales(1)} disabled={salesLoading}>{salesLoading ? "Cargando…" : "Filtrar"}</Button>
            {salesError && <span className="text-sm text-red-600">{salesError}</span>}
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">VENTAS {sales ? `(${sales.totalCount})` : ""}</h3>
            {salesLoading ? <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p> : <DataTable columns={salesColumns} data={sales?.items ?? []} label="Venta" placeholder="Buscar…" />}
            {sales && sales.totalCount > sales.pageSize && (
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" size="sm" disabled={salesPage <= 1} onClick={() => fetchSales(salesPage - 1)}>Anterior</Button>
                <span className="text-sm py-2">Pág. {sales.page} de {Math.ceil(sales.totalCount / sales.pageSize)}</span>
                <Button variant="outline" size="sm" disabled={sales.page * sales.pageSize >= sales.totalCount} onClick={() => fetchSales(salesPage + 1)}>Siguiente</Button>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "audits" && (
        <>
          <div className="flex gap-3 items-end bg-card p-4 rounded-xl border border-border">
            <div className="flex-1"><label className="text-sm">Filtrar por motivo contiene</label><Input value={auditReason} onChange={(e) => setAuditReason(e.target.value)} placeholder="Ej: Sale, inicial" /></div>
            <Button onClick={() => fetchAudits(1)} disabled={auditLoading}>{auditLoading ? "Cargando…" : "Buscar"}</Button>
            {auditError && <span className="text-sm text-red-600">{auditError}</span>}
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Auditoría de stock {audits ? `(${audits.totalCount})` : ""}</h3>
            {auditLoading ? <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p> : <DataTable columns={auditColumns} data={audits?.items ?? []} label="Auditoría" placeholder="Buscar…" />}
            {audits && audits.totalCount > audits.pageSize && (
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => fetchAudits(auditPage - 1)}>Anterior</Button>
                <span className="text-sm py-2">Pág. {audits.page} de {Math.ceil(audits.totalCount / audits.pageSize)}</span>
                <Button variant="outline" size="sm" disabled={audits.page * audits.pageSize >= audits.totalCount} onClick={() => fetchAudits(auditPage + 1)}>Siguiente</Button>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
