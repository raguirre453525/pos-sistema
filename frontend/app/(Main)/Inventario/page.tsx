"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import StatCard from "@/components/Dashboard/StatCard";
import DataTable from "@/components/Reusables/DataTable";
import { createProductColumns } from "@/components/Inventario/DataTable/productColumns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Package, PackagePlus } from "lucide-react";
import { getProducts, adjustStock, deleteProduct, ProductDto, ApiError } from "@/lib/api";

export default function InventarioPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adjustTarget, setAdjustTarget] = useState<ProductDto | null>(null);
  const [delta, setDelta] = useState<string>("1");
  const [reason, setReason] = useState<string>("Ajuste manual");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar productos";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const totalValue = useMemo(
    () => products.reduce((acc, p) => acc + p.price * p.stock, 0),
    [products]
  );

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    const deltaNum = parseInt(delta, 10);
    if (isNaN(deltaNum) || deltaNum === 0) {
      setAdjustError("Delta debe ser un entero distinto de 0");
      return;
    }
    if (!reason.trim() || reason.trim().length > 250) {
      setAdjustError("Motivo requerido (1..250 caracteres)");
      return;
    }
    setAdjustLoading(true);
    setAdjustError(null);
    try {
      await adjustStock(adjustTarget.id, { delta: deltaNum, reason: reason.trim() });
      setAdjustTarget(null);
      setDelta("1");
      setReason("Ajuste manual");
      await fetchProducts();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al ajustar stock";
      setAdjustError(msg);
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleDelete = async (product: ProductDto) => {
    if (!confirm(`¿Eliminar ${product.name} (${product.sku})? Se hará soft-delete.`)) return;
    try {
      await deleteProduct(product.id);
      await fetchProducts();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al eliminar";
      alert(msg);
    }
  };

  const columns = useMemo(
    () =>
      createProductColumns({
        onAdjust: (p) => {
          setAdjustTarget(p);
          setAdjustError(null);
        },
        onDelete: handleDelete,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-foreground text-2xl">INVENTARIO</h1>

      <div className="flex justify-between items-center">
        <StatCard
          title="Valor Total de Activos"
          value={`$${totalValue.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
          icon={Package}
          color="bg-white-100 text-black-600 border border-gray-200"
        />
        <Link href="/Inventario/CrearProd">
          <Button variant="outline" size="lg" className="flex ml-auto mt-20">
            <PackagePlus className="mr-1" />
            Crear Producto
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchProducts}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card h-full rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">PRODUCTOS</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Cargando productos…</p>
          ) : (
            <DataTable columns={columns} data={products} label="Producto" placeholder="Buscar por SKU, nombre…" />
          )}
        </div>
      </div>

      {/* Stock adjustment modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Ajustar stock — {adjustTarget.name}</h3>
            <p className="text-sm text-muted-foreground">
              SKU: {adjustTarget.sku} · Stock actual: {adjustTarget.stock}
            </p>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">Delta (+/-)</label>
                <Input
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="Ej: 5 o -3"
                />
              </div>
              <Button variant="outline" onClick={() => setDelta(String(parseInt(delta || "0", 10) - 1))}>
                -1
              </Button>
              <Button variant="outline" onClick={() => setDelta(String(parseInt(delta || "0", 10) + 1))}>
                +1
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium">Motivo (1..250)</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={250} placeholder="Ej: Recepción proveedor" />
            </div>

            {adjustError && <p className="text-sm text-red-600">{adjustError}</p>}

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAdjustTarget(null);
                  setAdjustError(null);
                }}
                disabled={adjustLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleAdjust} disabled={adjustLoading}>
                {adjustLoading ? "Guardando…" : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
