"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import ProdCard from "@/components/Ventas/ProdCard";
import CartBox from "@/components/Ventas/CartBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Trash2, Search, X, Plus, Minus, ChevronDown } from "lucide-react";
import {
  getProducts,
  getCategories,
  getCategoryProducts,
  createSale,
  getCustomers,
  createCustomer,
  getActivePromotions,
  ProductDto,
  CategoryDto,
  CustomerDto,
  PromotionDto,
  ApiError,
} from "@/lib/api";
import { Label } from "@/components/ui/label";

type CartItem = {
  product: ProductDto;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
};

type CartCombo = {
  promotion: PromotionDto;
  quantity: number;
};

export default function VentasPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [categoryProductIds, setCategoryProductIds] = useState<Set<string> | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartCombos, setCartCombos] = useState<CartCombo[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<0 | 1>(0);
  const [saleLoading, setSaleLoading] = useState(false);
  const [saleMsg, setSaleMsg] = useState<string | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [discountType, setDiscountType] = useState<"%" | "$">("%");
  const [discountValue, setDiscountValue] = useState("0");
  const [showCheckout, setShowCheckout] = useState(false);
  const [cashPaid, setCashPaid] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [creditCustomerId, setCreditCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [creditDueDays, setCreditDueDays] = useState("14");
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [inlinePhone, setInlinePhone] = useState("");
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [activePromos, setActivePromos] = useState<PromotionDto[]>([]);
  const [expandedCombos, setExpandedCombos] = useState<Set<string>>(new Set());

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

  const fetchCats = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data.filter((c) => c.isActive));
    } catch {
      // categories are not critical — leave empty
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCats();
    getCustomers().then(setCustomers).catch(() => {});
    getActivePromotions().then(setActivePromos).catch(() => {});
  }, [fetchProducts, fetchCats]);

  useEffect(() => {
    if (selectedCatId === "all") {
      setCategoryProductIds(null);
      return;
    }
    let cancelled = false;
    setCatLoading(true);
    getCategoryProducts(selectedCatId)
      .then((list) => {
        if (!cancelled) setCategoryProductIds(new Set(list.map((p) => p.id)));
      })
      .catch(() => {
        if (!cancelled) setCategoryProductIds(null);
      })
      .finally(() => {
        if (!cancelled) setCatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCatId]);

  const discountMap = useMemo(() => {
    const m = new Map<string, number>();
    activePromos.filter(p => p.type === 1).forEach(pr => {
      const lines = pr.lines?.length ? pr.lines : pr.products.map(p => ({ productId: p.id, quantity: 1 } as unknown as { productId: string; quantity: number; unitPrice: number; }));
      lines.forEach(l => {
        const disc = pr.discountPercentage ?? 0;
        const cur = m.get(l.productId) ?? 0;
        if (disc > cur) m.set(l.productId, disc);
      });
    });
    return m;
  }, [activePromos]);

  const addToCart = (product: ProductDto) => {
    setSaleMsg(null);
    setSaleError(null);
    const disc = discountMap.get(product.id) ?? 0;
    const unitPrice = disc > 0 ? product.price * (1 - disc / 100) : product.price;
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
      return [...prev, { product, quantity: 1, unitPrice, originalPrice: product.price }];
    });
  };

  const inc = (id: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product.id !== id) return c;
        if (c.quantity + 1 > c.product.stock) {
          setSaleError(`Stock insuficiente para ${c.product.name}. Disponible: ${c.product.stock}`);
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

  const handleAddCombo = (promo: PromotionDto) => {
    setSaleMsg(null);
    setSaleError(null);
    setCartCombos(prev => {
      const idx = prev.findIndex(c => c.promotion.id === promo.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { promotion: promo, quantity: 1 }];
    });
  };
  const incCombo = (id: string) => setCartCombos(prev => prev.map(c => c.promotion.id === id ? { ...c, quantity: Math.min(99, c.quantity + 1) } : c));
  const decCombo = (id: string) => setCartCombos(prev => {
    const item = prev.find(c => c.promotion.id === id);
    if (!item) return prev;
    if (item.quantity <= 1) return prev.filter(c => c.promotion.id !== id);
    return prev.map(c => c.promotion.id === id ? { ...c, quantity: c.quantity - 1 } : c);
  });
  const removeCombo = (id: string) => setCartCombos(prev => prev.filter(c => c.promotion.id !== id));
  const toggleExpand = (id: string) => setExpandedCombos(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleVaciar = () => {
    if (cart.length === 0 && cartCombos.length === 0) return;
    if (confirm("¿Vaciar carrito?")) {
      setCart([]);
      setCartCombos([]);
      setSaleError(null);
    }
  };

  const comboPromos = useMemo(() => activePromos.filter(p => p.type === 0), [activePromos]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesCategory = selectedCatId === "all" || categoryProductIds === null ? true : categoryProductIds.has(p.id);
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCatId, categoryProductIds]);

  const subtotalNormal = useMemo(() => cart.reduce((acc, c) => acc + c.unitPrice * c.quantity, 0), [cart]);
  const subtotalCombos = useMemo(() => cartCombos.reduce((acc, cc) => acc + (cc.promotion.comboPrice ?? 0) * cc.quantity, 0), [cartCombos]);
  const discountNum = parseFloat(discountValue) || 0;
  const discountAmountRaw = discountType === "%" ? subtotalNormal * (discountNum / 100) : discountNum;
  const discountAmount = Math.min(Math.max(0, discountAmountRaw), subtotalNormal);
  const total = Math.max(0, subtotalNormal - discountAmount + subtotalCombos);

  const cashNum = parseFloat(cashPaid) || 0;
  const vuelto = Math.max(0, cashNum - total);
  const falta = Math.max(0, total - cashNum);

  const customerSearchResults = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === creditCustomerId) ?? null, [customers, creditCustomerId]);

  const exactMatch = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return false;
    return customers.some((c) => c.name.toLowerCase() === q);
  }, [customers, customerSearch]);

  const dueDateHint = useMemo(() => {
    const days = parseInt(creditDueDays, 10);
    if (!days || days < 1 || days > 365) return null;
    const d = new Date(Date.now() + days * 86400000);
    return d.toLocaleDateString("es-AR");
  }, [creditDueDays]);

  const handleInlineCreate = async () => {
    const name = inlineName.trim();
    if (name.length < 2) {
      setInlineError("Nombre mínimo 2 caracteres");
      return;
    }
    setInlineLoading(true);
    setInlineError(null);
    try {
      const newCustomer = await createCustomer({ name, phone: inlinePhone.trim() || null });
      setCustomers((prev) => [...prev, newCustomer]);
      setCreditCustomerId(newCustomer.id);
      setShowInlineCreate(false);
      setInlineName("");
      setInlinePhone("");
      setCustomerSearch("");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al crear cliente";
      setInlineError(msg);
    } finally {
      setInlineLoading(false);
    }
  };

  const handleConfirmSale = async () => {
    if (cart.length === 0 && cartCombos.length === 0) {
      setSaleError("Carrito vacío");
      return;
    }
    if (isCredit && !creditCustomerId) {
      setSaleError("Seleccioná un cliente para fiado");
      return;
    }
    if (!isCredit && paymentMethod === 0 && cashNum < total) {
      setSaleError(`Falta $${(total - cashNum).toLocaleString("es-AR")}`);
      return;
    }
    if (isCredit && selectedCustomer) {
      const days = parseInt(creditDueDays, 10);
      if (!days || days < 1 || days > 365) {
        setSaleError("Plazo debe ser entre 1 y 365 días");
        return;
      }
    }
    setSaleLoading(true);
    setSaleError(null);
    setSaleMsg(null);
    try {
      const dueDaysNum = isCredit ? parseInt(creditDueDays, 10) : undefined;
      // Si backend aún no acepta combos, fallback visual: enviar solo items sueltos pero total ya es visual correcto; avisar
      const dto = {
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        combos: cartCombos.map(cc => ({ promotionId: cc.promotion.id, quantity: cc.quantity })),
        paymentMethod,
        customerId: isCredit ? creditCustomerId : null,
        isCredit,
        dueDays: isCredit && dueDaysNum && dueDaysNum >= 1 && dueDaysNum <= 365 ? dueDaysNum : undefined,
      };
      // Debug historial
      console.debug("Sale combos", dto.combos, "items", dto.items);
      let sale;
      try {
        sale = await createSale(dto);
      } catch (err) {
        // Fallback si backend viejo no acepta combos: intentar solo items
        if (cartCombos.length > 0 && err instanceof ApiError && err.status === 400) {
          console.warn("Backend combos no soportado, fallback visual - recalculando items prorrateados");
          // Parche visual: seguir mostrando total correcto pero enviar solo items (backend cobrará suma suelta - diferencia)
          // Preferimos rethrow con mensaje claro
          throw err;
        }
        throw err;
      }
      const backendTotal = Number(sale.total);
      const discountNote = discountAmount > 0 ? ` (visual con dto: $${total.toLocaleString("es-AR")})` : "";
      if (sale.salePromotions && sale.salePromotions.length > 0) {
        console.debug("SalePromotions retornadas", sale.salePromotions);
      }
      if (isCredit) {
        setSaleMsg(`Venta fiada registrada #${sale.id.slice(0, 8)} — ${selectedCustomer?.name ?? ""} — Total $${backendTotal.toLocaleString("es-AR")}${discountNote}`);
      } else {
        setSaleMsg(`Venta OK #${sale.id.slice(0, 8)} — Total $${backendTotal.toLocaleString("es-AR")}${discountNote}`);
      }
      setCart([]);
      setCartCombos([]);
      setDiscountValue("0");
      setCashPaid("");
      setShowCheckout(false);
      setIsCredit(false);
      setCreditCustomerId("");
      setCustomerSearch("");
      setCreditDueDays("14");
      setShowInlineCreate(false);
      setInlineName("");
      setInlinePhone("");
      setInlineError(null);
      await fetchProducts();
      getCustomers().then(setCustomers).catch(() => {});
      getActivePromotions().then(setActivePromos).catch(() => {});
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cobrar";
      setSaleError(msg);
    } finally {
      setSaleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-foreground text-2xl font-black tracking-tight">VENTAS</h1>
        {saleMsg && (
          <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">{saleMsg}</span>
        )}
        {saleError && (
          <span className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{saleError}</span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchProducts}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: products */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o SKU..."
              className="pl-9 bg-card"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <Button
              size="sm"
              variant={selectedCatId === "all" ? "default" : "outline"}
              className="whitespace-nowrap shrink-0"
              onClick={() => setSelectedCatId("all")}
            >
              Todos
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={selectedCatId === c.id ? "default" : "outline"}
                className="whitespace-nowrap shrink-0"
                onClick={() => setSelectedCatId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>

          {comboPromos.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 rounded-2xl p-3">
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2">Combos activos</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {comboPromos.map(pr => {
                  const totalOrig = pr.totalOriginalPrice ?? pr.lines?.reduce((s,x)=>s+x.lineTotal,0) ?? 0;
                  const saving = pr.savingAmount ?? 0;
                  const pct = pr.savingPercent ?? 0;
                  const linesDesc = pr.lines?.map(l => `${l.productName} x${l.quantity}`).join(", ") ?? pr.products.map(x=>x.name).join(", ");
                  return (
                    <div key={pr.id} className="min-w-[260px] bg-card border border-amber-200 rounded-xl p-3 shrink-0">
                      <div className="font-semibold text-sm">{pr.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{linesDesc}</div>
                      <div className="text-xs mt-2"><span className="line-through text-muted-foreground">${totalOrig.toLocaleString("es-AR")}</span><span className="mx-1">→</span><span className="font-bold text-amber-700">Combo ${Number(pr.comboPrice).toLocaleString("es-AR")}</span><span className="ml-2 bg-emerald-600 text-white px-1.5 py-0.5 rounded text-xs">Ahorrás {pct.toFixed(0)}%</span></div>
                      <div className="text-xs text-emerald-700">Ahorrás ${saving.toLocaleString("es-AR")}</div>
                      <Button size="sm" className="w-full mt-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={()=>handleAddCombo(pr)}>Agregar combo</Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-4">
            {loading || catLoading ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Cargando productos…</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                {products.length === 0 ? "Sin productos activos." : "Sin resultados para el filtro."}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((p) => {
                  const disc = discountMap.get(p.id);
                  const hasDisc = disc != null && disc > 0;
                  const discPrice = hasDisc ? p.price * (1 - disc! / 100) : p.price;
                  return (
                    <div key={p.id} className="relative">
                      {hasDisc && <span className="absolute -top-2 -right-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">-{disc}%</span>}
                      <ProdCard
                        name={p.name}
                        image="/img-prod.webp"
                        category={p.description ?? "—"}
                        stock={p.stock}
                        price={hasDisc ? discPrice : p.price}
                        disabled={p.stock === 0}
                        onAdd={() => addToCart(p)}
                      />
                      {hasDisc && <div className="text-xs text-center mt-1"><span className="line-through text-muted-foreground">${p.price.toLocaleString("es-AR")}</span><span className="text-red-600 font-semibold ml-1">Ahora ${discPrice.toLocaleString("es-AR")}</span></div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: factura panel */}
        <div className="lg:col-span-1 bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col h-fit lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">FACTURA</h2>
            {(cart.length > 0 || cartCombos.length > 0) && (
              <Button variant="ghost" size="sm" onClick={handleVaciar} className="text-muted-foreground hover:text-foreground">
                <Trash2 className="h-4 w-4" />
                Vaciar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Cliente: Consumidor Final</p>
          <Separator className="my-3" />

          <div className="flex-1 overflow-y-auto pr-1 max-h-[40vh] lg:max-h-[38vh] space-y-2">
            {cart.length === 0 && cartCombos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carrito vacío — agregá productos o combos</p>
            ) : (
              <>
                {cartCombos.map((cc) => {
                  const promo = cc.promotion;
                  const linesDesc = promo.lines?.map(l => `${l.productName} x${l.quantity}`).join(", ") ?? promo.products.map(p=>p.name).join(", ");
                  const unit = promo.comboPrice ?? 0;
                  const totalOrig = promo.totalOriginalPrice ?? promo.lines?.reduce((s,l)=>s+l.lineTotal,0) ?? 0;
                  const pct = promo.savingPercent ?? (totalOrig>0 ? (totalOrig-unit)/totalOrig*100 : 0);
                  const isExpanded = expandedCombos.has(promo.id);
                  return (
                    <div key={promo.id} className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {promo.name} ×{cc.quantity}
                            <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded">Ahorrás {pct.toFixed(0)}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Productos: {linesDesc}</div>
                          <div className="text-sm mt-1"><span className="line-through text-muted-foreground text-xs">${totalOrig.toLocaleString("es-AR")}</span><span className="ml-2 font-bold text-amber-700">${unit.toLocaleString("es-AR")} c/u</span><span className="ml-2 font-semibold">= ${ (unit*cc.quantity).toLocaleString("es-AR")}</span></div>
                          {isExpanded && (
                            <div className="mt-2 text-xs bg-card border rounded p-2">
                              {promo.lines?.map(l => (
                                <div key={l.productId} className="flex justify-between"><span>{l.productName} ×{l.quantity}</span><span>{l.lineTotal.toLocaleString("es-AR")}</span></div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0" onClick={() => removeCombo(promo.id)}><X className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <Button variant="outline" size="icon-sm" className="h-7 w-7 rounded-full" onClick={() => decCombo(promo.id)}><Minus className="h-3 w-3" /></Button>
                        <span className="text-sm font-semibold w-6 text-center">{cc.quantity}</span>
                        <Button variant="outline" size="icon-sm" className="h-7 w-7 rounded-full" onClick={() => incCombo(promo.id)}><Plus className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="ml-2 text-xs h-7" onClick={() => toggleExpand(promo.id)}><ChevronDown className={`h-3 w-3 mr-1 transition ${isExpanded?'rotate-180':''}`} />{isExpanded?'Ocultar':'Detalle'}</Button>
                      </div>
                    </div>
                  );
                })}
                {cart.map((c) => (
                  <div key={c.product.id} className={c.unitPrice < c.originalPrice ? "border border-red-200 rounded-xl" : ""}>
                    <CartBox
                      name={c.product.name}
                      price={c.unitPrice}
                      image="/img-prod.webp"
                      quantity={c.quantity}
                      stock={c.product.stock}
                      onInc={() => inc(c.product.id)}
                      onDec={() => dec(c.product.id)}
                      onRemove={() => remove(c.product.id)}
                    />
                    {c.unitPrice < c.originalPrice && (
                      <div className="px-3 pb-2 -mt-2 text-xs text-red-600">Precio con dto: <span className="line-through text-muted-foreground">${c.originalPrice.toLocaleString("es-AR")}</span> → ${c.unitPrice.toLocaleString("es-AR")}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          <Separator className="my-3" />

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal sueltos</span>
              <span className="font-medium">${subtotalNormal.toLocaleString("es-AR")}</span>
            </div>
            {cartCombos.length>0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Combos ({cartCombos.reduce((s,c)=>s+c.quantity,0)} u.)</span>
                <span className="font-medium text-amber-700">${subtotalCombos.toLocaleString("es-AR")}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground whitespace-nowrap">Descuento {discountAmount > 0 ? `(-$${discountAmount.toLocaleString("es-AR")})` : ""}</span>
              <div className="flex items-center gap-1">
                <div className="flex rounded-lg border border-input overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDiscountType("%")}
                    className={`px-2 py-1 text-xs font-semibold ${discountType === "%" ? "bg-primary text-primary-foreground" : "bg-card"}`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("$")}
                    className={`px-2 py-1 text-xs font-semibold border-l border-input ${discountType === "$" ? "bg-primary text-primary-foreground" : "bg-card"}`}
                  >
                    $
                  </button>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-20 h-7 text-right"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-between items-center text-2xl font-black pt-1">
              <span>Total</span>
              <span>${total.toLocaleString("es-AR")}</span>
            </div>
            {discountAmount > 0 && (
              <p className="text-xs text-muted-foreground">Descuento visual — el backend cobra sin descuento manual.</p>
            )}
            {subtotalCombos>0 && <p className="text-xs text-emerald-700">Total usa precio combo (${subtotalCombos.toLocaleString("es-AR")}), no suma suelta.</p>}
          </div>

          <Button
            className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-6 rounded-xl transition-all disabled:opacity-50 text-base"
            disabled={(cart.length === 0 && cartCombos.length===0) || saleLoading}
            onClick={() => {
              setSaleError(null);
              setPaymentMethod(0);
              setCashPaid("");
              setShowCheckout(true);
            }}
          >
            Cobrar ${total.toLocaleString("es-AR")}
          </Button>
        </div>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCheckout(false)}>
          <div
            className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-md flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Confirmar venta</h3>
            <div className="rounded-xl bg-muted p-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total a cobrar</span>
              <span className="text-xl font-black">${total.toLocaleString("es-AR")}</span>
            </div>
            {(discountAmount > 0 || subtotalCombos>0) && (
              <p className="text-xs text-muted-foreground -mt-2">
                Sueltos ${subtotalNormal.toLocaleString("es-AR")} {discountAmount>0 && `- Descuento ${discountAmount.toLocaleString("es-AR")}`} {subtotalCombos>0 && `+ Combos ${subtotalCombos.toLocaleString("es-AR")}`}
              </p>
            )}

            <div className={`bg-card border rounded-xl p-3 flex items-center gap-3 ${isCredit ? "border-primary bg-primary/10" : "border-border"}`}>
              <input
                id="fiado-switch"
                type="checkbox"
                checked={isCredit}
                onChange={(e) => setIsCredit(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <Label htmlFor="fiado-switch" className="text-sm font-semibold text-foreground cursor-pointer">
                Fiado
              </Label>
              <span className="text-sm text-muted-foreground">Venta pendiente</span>
            </div>

            {isCredit && (
              <div className="flex flex-col gap-2 p-3 rounded-xl border bg-muted/50">
                {!selectedCustomer ? (
                  <>
                    <Label className="text-sm">Buscar cliente *</Label>
                    <Input placeholder="Buscar cliente..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                    <div className="max-h-32 overflow-auto border rounded-lg bg-card divide-y">
                      {customerSearchResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2 text-center">Sin resultados</p>
                      ) : (
                        customerSearchResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setCreditCustomerId(c.id);
                              setCustomerSearch("");
                              setShowInlineCreate(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{c.phone ?? ""}</span>
                            {c.balance > 0 && <span className="ml-2 text-xs text-red-600">Debe ${Number(c.balance).toLocaleString("es-AR")}</span>}
                          </button>
                        ))
                      )}
                    </div>
                    {customerSearch.trim().length >= 2 && !exactMatch && customerSearchResults.length === 0 && !showInlineCreate && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setInlineName(customerSearch.trim());
                          setInlinePhone("");
                          setShowInlineCreate(true);
                        }}
                      >
                        + Crear &quot;{customerSearch.trim()}&quot;
                      </Button>
                    )}
                    {showInlineCreate && (
                      <div className="flex flex-col gap-2 p-2 rounded-lg border bg-card">
                        <Label className="text-xs">Nuevo cliente</Label>
                        <Input placeholder="Nombre" value={inlineName} onChange={(e) => setInlineName(e.target.value)} />
                        <Input placeholder="Teléfono (opcional)" value={inlinePhone} onChange={(e) => setInlinePhone(e.target.value)} />
                        {inlineError && <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded p-1">{inlineError}</p>}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowInlineCreate(false)}>Cancelar</Button>
                          <Button size="sm" className="flex-1" onClick={handleInlineCreate} disabled={inlineLoading}>
                            {inlineLoading ? "Creando…" : "Crear y seleccionar"}
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Seleccioná un cliente para confirmar fiado.</p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">
                        Cliente: <span className="font-semibold">{selectedCustomer.name}</span> {selectedCustomer.phone ? `(${selectedCustomer.phone})` : ""}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setCreditCustomerId("")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1 pt-2">
                      <Label className="text-sm">Plazo (días)</Label>
                      <Input type="number" min={1} max={365} value={creditDueDays} onChange={(e) => setCreditDueDays(e.target.value)} className="bg-background" />
                      {dueDateHint && <span className="text-xs text-muted-foreground">Vence: {dueDateHint}</span>}
                    </div>
                  </>
                )}
              </div>
            )}

            {!isCredit && (
              <div className="flex gap-2">
                <Button
                  variant={paymentMethod === 0 ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setPaymentMethod(0)}
                >
                  Efectivo
                </Button>
                <Button
                  variant={paymentMethod === 1 ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setPaymentMethod(1)}
                >
                  MercadoPago
                </Button>
              </div>
            )}

            {!isCredit && paymentMethod === 0 ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Pagó con $</label>
                <Input
                  type="number"
                  min={0}
                  value={cashPaid}
                  onChange={(e) => setCashPaid(e.target.value)}
                  placeholder="0"
                  className="bg-background"
                />
                {cashPaid !== "" && (
                  <div className="text-sm">
                    {cashNum >= total ? (
                      <span className="text-green-700 font-semibold">Vuelto: ${vuelto.toLocaleString("es-AR")}</span>
                    ) : (
                      <span className="text-red-600 font-semibold">Falta: ${falta.toLocaleString("es-AR")}</span>
                    )}
                  </div>
                )}
              </div>
            ) : !isCredit ? (
              <div className="rounded-lg border border-border bg-muted p-3 text-sm">
                <p className="font-medium">Total: ${total.toLocaleString("es-AR")}</p>
                <p className="text-muted-foreground text-xs mt-1">Se registrará como MercadoPago.</p>
              </div>
            ) : null}

            {isCredit && <p className="text-xs text-muted-foreground bg-muted border border-border rounded p-2">Venta fiada — no hay vuelto. Quedará pendiente para {selectedCustomer?.name ?? "cliente"}. {dueDateHint ? `Vence ${dueDateHint}.` : ""}</p>}

            {saleError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{saleError}</div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowCheckout(false)} disabled={saleLoading}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmSale}
                disabled={saleLoading || (isCredit ? !creditCustomerId : paymentMethod === 0 && cashPaid !== "" && cashNum < total)}
                className="bg-red-600 hover:bg-red-700 text-white min-w-[140px]"
              >
                {saleLoading ? "Procesando…" : "Confirmar venta"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
