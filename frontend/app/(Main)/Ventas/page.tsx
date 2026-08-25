"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import ProdCard from "@/components/Ventas/ProdCard";
import CartBox from "@/components/Ventas/CartBox";
import { Button } from "@/components/ui/button";
import { getProducts, createSale, ProductDto, ApiError } from "@/lib/api";

type CartItem = {
  product: ProductDto;
  quantity: number;
};

export default function VentasPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<0 | 1>(0);
  const [saleLoading, setSaleLoading] = useState(false);
  const [saleMsg, setSaleMsg] = useState<string | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);

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

  const addToCart = (product: ProductDto) => {
    setSaleMsg(null);
    setSaleError(null);
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const cur = prev[idx];
        if (cur.quantity + 1 > product.stock) {
          setSaleError(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...cur, quantity: cur.quantity + 1 };
        return next;
      }
      if (product.stock < 1) {
        setSaleError(`Sin stock: ${product.name}`);
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const inc = (id: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product.id !== id) return c;
        if (c.quantity + 1 > c.product.stock) {
          setSaleError(`Stock insuficiente para ${c.product.name}`);
          return c;
        }
        return { ...c, quantity: c.quantity + 1 };
      })
    );
  };
  const dec = (id: string) => {
    setCart((prev) => {
      const item = prev.find((c) => c.product.id === id);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((c) => c.product.id !== id);
      return prev.map((c) => (c.product.id === id ? { ...c, quantity: c.quantity - 1 } : c));
    });
  };
  const remove = (id: string) => setCart((prev) => prev.filter((c) => c.product.id !== id));

  const total = useMemo(() => cart.reduce((acc, c) => acc + c.product.price * c.quantity, 0), [cart]);

  const handleCobrar = async () => {
    if (cart.length === 0) {
      setSaleError("Carrito vacío");
      return;
    }
    setSaleLoading(true);
    setSaleError(null);
    setSaleMsg(null);
    try {
      const sale = await createSale({
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        paymentMethod,
      });
      setSaleMsg(`Venta OK #${sale.id.slice(0, 8)} — Total $${Number(sale.total).toLocaleString("es-AR")}`);
      setCart([]);
      await fetchProducts();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cobrar";
      setSaleError(msg);
    } finally {
      setSaleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 flex flex-col gap-6">
      <h1 className="text-foreground text-2xl">VENTAS</h1>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm font-medium">Método de pago:</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(Number(e.target.value) as 0 | 1)}
          className="border border-input rounded-lg px-3 py-1.5 text-sm bg-card"
        >
          <option value={0}>Efectivo</option>
          <option value={1}>MercadoPago</option>
        </select>
        <span className="text-sm text-muted-foreground">Total carrito: ${total.toLocaleString("es-AR")}</span>
        {saleMsg && <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">{saleMsg}</span>}
        {saleError && <span className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{saleError}</span>}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchProducts}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 py-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Cargando productos…</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Sin productos activos.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p) => (
                <ProdCard
                  key={p.id}
                  name={p.name}
                  image="/img-prod.webp"
                  category={p.description ?? "—"}
                  stock={p.stock}
                  price={p.price}
                  disabled={p.stock === 0}
                  onAdd={() => addToCart(p)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-1 bg-card h-[calc(100vh-12rem)] rounded-2xl border border-border shadow-sm p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-foreground">FACTURA</h2>

          <div className="flex-1 overflow-y-auto pr-2">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carrito vacío — agregá productos</p>
            ) : (
              cart.map((c) => (
                <CartBox
                  key={c.product.id}
                  name={c.product.name}
                  price={c.product.price}
                  image="/img-prod.webp"
                  quantity={c.quantity}
                  onInc={() => inc(c.product.id)}
                  onDec={() => dec(c.product.id)}
                  onRemove={() => remove(c.product.id)}
                />
              ))
            )}
          </div>

          <div className="border-t border-border pt-3 mt-3 flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span>${total.toLocaleString("es-AR")}</span>
          </div>

          <Button
            className="w-full mt-4 bg-red-600 hover:bg-red-800 text-white font-bold py-6 rounded-xl transition-all disabled:opacity-50"
            disabled={cart.length === 0 || saleLoading}
            onClick={handleCobrar}
          >
            {saleLoading ? "Procesando…" : "Cobrar"}
          </Button>
        </div>
      </div>
    </main>
  );
}
