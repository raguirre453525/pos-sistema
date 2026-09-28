"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import SaleCard from "@/components/Ventas/SaleCard";
import CartBox from "@/components/Ventas/CartBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Trash2, Search, X, Plus, Minus, ChevronDown, User, ShoppingCart } from "lucide-react";
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
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useFeatureGuard } from "@/hooks/useFeatureGuard";

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
  const { allowed } = useFeatureGuard({ denyRoles: ["SuperAdmin"], redirectTo: "/Admin/Negocios" });
  const { flags } = useFeatureFlags();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [categoryProductIds, setCategoryProductIds] = useState<Set<string> | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartCombos, setCartCombos] = useState<CartCombo[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<0 | 1 | 2>(0);
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
  const searchRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const fiadoSearchRef = useRef<HTMLInputElement>(null);
  const [vaciarConfirm, setVaciarConfirm] = useState(false);
  const vaciarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flag: if moduloClientes is off, force cash payment and clear fiado state
  useEffect(() => {
    if (!flags.moduloClientes && isCredit) {
      setIsCredit(false);
      setPaymentMethod(0);
    }
  }, [flags.moduloClientes, isCredit]);

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

  // Autofocus principal buscador al cargar + atajos F2 / Escape
  useEffect(() => {
    // pequeño timeout para asegurar que el DOM esté listo tras el primer render
    const t = setTimeout(() => searchRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Barra espaciadora → enfoca buscador (solo si no está tipeando en un input)
      if (e.key === " " || e.code === "Space") {
        if (showCheckout) return;
        const active = document.activeElement as HTMLElement | null;
        const isTyping =
          !!active &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable);
        if (isTyping) return;
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === "F2" || e.key === "Escape") {
        if (showCheckout) return;
        // F2/Escape roban foco siempre, incluso si está escribiendo en otro input
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCheckout]);

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

  const isWeightProduct = (p: ProductDto) =>
    p.isSoldByWeight === true || (p.unit ?? "").toLowerCase() === "kg" || (p.unit ?? "").toLowerCase() === "granel";

  const formatStock = (p: ProductDto) => {
    const unitLabel = isWeightProduct(p) ? "kg" : "un.";
    const stockStr = Number(p.stock).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    return `Stock: ${stockStr} ${unitLabel}`;
  };

  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  const addToCart = (product: ProductDto) => {
    setSaleMsg(null);
    setSaleError(null);
    const disc = discountMap.get(product.id) ?? 0;
    const unitPrice = disc > 0 ? product.price * (1 - disc / 100) : product.price;
    const isWeight = isWeightProduct(product);
    const initialQty = isWeight ? 0.5 : 1;
    const step = isWeight ? 0.1 : 1;
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const cur = prev[idx];
        const nextQty = round3(cur.quantity + step);
        if (nextQty > product.stock + 1e-9) {
          setSaleError(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);
          return prev;
        }
        if (!isWeight && !Number.isInteger(nextQty)) {
          setSaleError(`El producto ${product.name} se vende por unidad: cantidad entera`);
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...cur, quantity: nextQty };
        return next;
      }
      if (product.stock < initialQty - 1e-9) {
        setSaleError(`Sin stock: ${product.name}`);
        return prev;
      }
      // Si es por unidad pero initialQty no entero (no ocurre), asegura entero
      const qty = isWeight ? round3(initialQty) : Math.trunc(initialQty);
      return [...prev, { product, quantity: qty, unitPrice, originalPrice: product.price }];
    });
  };

  const inc = (id: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product.id !== id) return c;
        const isWeight = isWeightProduct(c.product);
        const step = isWeight ? 0.1 : 1;
        const nextQty = round3(c.quantity + step);
        if (nextQty > c.product.stock + 1e-9) {
          setSaleError(`Stock insuficiente para ${c.product.name}. Disponible: ${c.product.stock}`);
          return c;
        }
        return { ...c, quantity: nextQty };
      })
    );
  };
  const dec = (id: string) => {
    setCart((prev) => {
      const item = prev.find((c) => c.product.id === id);
      if (!item) return prev;
      const isWeight = isWeightProduct(item.product);
      const step = isWeight ? 0.1 : 1;
      const nextQty = round3(item.quantity - step);
      if (nextQty <= 0) return prev.filter((c) => c.product.id !== id);
      // evita 0.0x flotante
      return prev.map((c) => (c.product.id === id ? { ...c, quantity: nextQty <= 0 ? 0 : nextQty } : c));
    });
  };
  const setQty = (id: string, raw: string) => {
    const parsed = parseFloat(raw.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      // si vacía o inválida, no actualizar; deja que usuario corrija
      return;
    }
    setCart((prev) =>
      prev.map((c) => {
        if (c.product.id !== id) return c;
        const isWeight = isWeightProduct(c.product);
        let v = round3(parsed);
        if (!isWeight) v = Math.round(v);
        if (v > c.product.stock + 1e-9) {
          setSaleError(`Stock insuficiente para ${c.product.name}. Disponible: ${c.product.stock}`);
          // clamp a stock
          v = c.product.stock;
          if (!isWeight) v = Math.trunc(v);
        }
        if (!isWeight && !Number.isInteger(v)) v = Math.round(v);
        // valida 3 decimales
        if (isWeight && round3(v) !== v) v = round3(v);
        return { ...c, quantity: v };
      })
    );
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
    if (!vaciarConfirm) {
      setVaciarConfirm(true);
      if (vaciarTimeoutRef.current) clearTimeout(vaciarTimeoutRef.current);
      vaciarTimeoutRef.current = setTimeout(() => setVaciarConfirm(false), 3000);
      return;
    }
    if (vaciarTimeoutRef.current) clearTimeout(vaciarTimeoutRef.current);
    setVaciarConfirm(false);
    setCart([]);
    setCartCombos([]);
    setSaleError(null);
  };

  useEffect(() => {
    return () => {
      if (vaciarTimeoutRef.current) clearTimeout(vaciarTimeoutRef.current);
    };
  }, []);

  const comboPromos = useMemo(() => activePromos.filter(p => p.type === 0), [activePromos]);

  const visibleComboPromos = useMemo(() => (flags.moduloPromos ? comboPromos : []), [comboPromos, flags.moduloPromos]);

  const visibleCategories = useMemo(() => {
    if (flags.moduloPromos) return categories;
    // filter out "Promos"/"Combos" category when promos disabled
    return categories.filter((c) => {
      const n = c.name.trim().toLowerCase();
      return n !== "promos" && n !== "combos" && n !== "promo" && n !== "combo";
    });
  }, [categories, flags.moduloPromos]);

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
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q) || (c.note ?? "").toLowerCase().includes(q))
      .slice(0, 8);
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
    if (!flags.moduloClientes && isCredit) {
      setSaleError("Módulo Clientes deshabilitado — fiado no disponible");
      setIsCredit(false);
      setPaymentMethod(0);
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

  // Modal checkout: autofocus según método
  useEffect(() => {
    if (!showCheckout) return;
    if (isCredit) {
      const t = setTimeout(() => fiadoSearchRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    if (paymentMethod === 0) {
      const t = setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 120);
      return () => clearTimeout(t);
    }
  }, [showCheckout, isCredit, paymentMethod]);

  // Atajos del modal: Enter confirma (si válido), Escape cancela
  useEffect(() => {
    if (!showCheckout) return;
    const onModalKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCheckout(false);
      } else if (e.key === "Enter") {
        const cashValid = cashPaid === "" || cashNum >= total;
        const canConfirm = isCredit ? !!creditCustomerId : paymentMethod === 0 ? cashValid : true;
        const hasItems = cart.length > 0 || cartCombos.length > 0;
        if (canConfirm && hasItems && !saleLoading) {
          e.preventDefault();
          handleConfirmSale();
        }
      }
    };
    window.addEventListener("keydown", onModalKey);
    return () => window.removeEventListener("keydown", onModalKey);
  }, [showCheckout, isCredit, creditCustomerId, paymentMethod, cashPaid, cashNum, total, saleLoading, cart.length, cartCombos.length]);

  if (!allowed) {
    return <div className="p-6 text-sm text-muted-foreground">Redirigiendo a /Admin/Negocios…</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 lg:overflow-hidden">
      {(saleMsg || saleError || error) && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-border bg-white dark:bg-card">
          <span className="text-xs font-bold tracking-widest text-slate-700 dark:text-foreground">VENTAS</span>
          {saleMsg && (
            <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">{saleMsg}</span>
          )}
          {saleError && (
            <span className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{saleError}</span>
          )}
          {error && (
            <span className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 flex items-center gap-2">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={fetchProducts} className="h-6 text-xs">
                Reintentar
              </Button>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 w-full min-w-full max-w-none lg:overflow-hidden">
        {/* Left: catálogo - full bleed, borde derecho sutil, sin márgenes flotantes */}
        <div className="flex-1 flex flex-col min-w-0 w-full max-w-none lg:overflow-hidden bg-white dark:bg-card lg:border-r border-slate-200 dark:border-border">
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-border bg-white dark:bg-card flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o SKU..."
                className="pl-10 pr-20 h-11 bg-slate-50 dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm placeholder:text-slate-400 focus:bg-white dark:focus:bg-card focus:border-slate-300 dark:focus:border-border focus:ring-2 focus:ring-slate-900/5 shadow-sm transition-all"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center font-mono text-xs px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-600 dark:bg-muted dark:border-border dark:text-muted-foreground shadow-sm">
                Espacio
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-thin">
            <Button
              size="sm"
              variant="outline"
              className={`whitespace-nowrap shrink-0 rounded-full border text-xs font-medium transition-colors ${
                selectedCatId === "all"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm hover:bg-slate-800 hover:text-white hover:border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white dark:hover:bg-zinc-100"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200 dark:bg-card dark:text-muted-foreground dark:border-border dark:hover:bg-muted"
              }`}
              onClick={() => setSelectedCatId("all")}
            >
              Todos
            </Button>
            {visibleCategories.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant="outline"
                className={`whitespace-nowrap shrink-0 rounded-full border text-xs font-medium transition-colors ${
                  selectedCatId === c.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm hover:bg-slate-800 hover:text-white hover:border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white dark:hover:bg-zinc-100"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200 dark:bg-card dark:text-muted-foreground dark:border-border dark:hover:bg-muted"
                }`}
                onClick={() => setSelectedCatId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-zinc-900/20 p-4">
            {loading || catLoading ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Cargando productos…</p>
            ) : (
              (() => {
                const q = search.trim().toLowerCase();
                const filteredCombos = visibleComboPromos.filter((pr) => {
                  if (!q) return true;
                  const linesDesc = pr.lines?.map((l) => `${l.productName} x${l.quantity}`).join(", ") ?? pr.products.map((x) => x.name).join(", ");
                  return pr.name.toLowerCase().includes(q) || linesDesc.toLowerCase().includes(q);
                });
                const hasProducts = filteredProducts.length > 0;
                const hasCombos = filteredCombos.length > 0;
                if (!hasProducts && !hasCombos) {
                  return (
                    <p className="text-sm text-muted-foreground py-10 text-center">
                      {products.length === 0 && visibleComboPromos.length === 0 ? "Sin productos activos." : "Sin resultados para el filtro."}
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 auto-rows-fr">
                    {filteredCombos.map((pr) => {
                      const linesDesc = pr.lines?.map((l) => `${l.productName} x${l.quantity}`).join(", ") ?? pr.products.map((x) => x.name).join(", ");
                      return (
                        <SaleCard
                          key={`combo-${pr.id}`}
                          name={pr.name}
                          imageUrl={pr.imageUrl ?? null}
                          subtitle={linesDesc || "Combo"}
                          sku={undefined}
                          stockText={null}
                          stockVariant="ok"
                          price={Number(pr.comboPrice ?? 0)}
                          originalPrice={null}
                          topBadge="COMBO"
                          savingText={null}
                          disabled={false}
                          buttonText="Agregar combo"
                          onAdd={() => handleAddCombo(pr)}
                        />
                      );
                    })}
                    {filteredProducts.map((p) => {
                      const disc = discountMap.get(p.id);
                      const hasDisc = disc != null && disc > 0;
                      const discPrice = hasDisc ? p.price * (1 - disc! / 100) : p.price;
                      const isWeight = isWeightProduct(p);
                      const unitLabel = isWeight ? "kg" : "un.";
                      const stockDisplay = Number(p.stock).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
                      const stockVariant: "out" | "low" | "ok" = p.stock <= 0 ? "out" : p.stock <= 5 ? "low" : "ok";
                      const stockText =
                        stockVariant === "out"
                          ? "Sin stock"
                          : stockVariant === "low"
                            ? `¡Poco stock: ${stockDisplay} ${unitLabel}`
                            : `Stock: ${stockDisplay} ${unitLabel}`;
                      return (
                        <SaleCard
                          key={p.id}
                          name={p.name}
                          imageUrl={p.imageUrl ?? "/img-prod.webp"}
                          subtitle={undefined}
                          sku={p.sku}
                          stockText={stockText}
                          stockVariant={stockVariant}
                          price={hasDisc ? discPrice : p.price}
                          originalPrice={null}
                          topBadge={hasDisc ? "PROMO" : null}
                          savingText={null}
                          disabled={p.stock <= 0}
                          buttonText="Agregar"
                          onAdd={() => addToCart(p)}
                        />
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Right: FACTURA / Ticket - acabado POS comercial, sin márgenes flotantes */}
        <div className="w-full lg:w-[380px] xl:w-[400px] shrink-0 bg-white dark:bg-card flex flex-col overflow-hidden lg:overflow-hidden border-t lg:border-t-0 border-slate-200 dark:border-border lg:border-l">
          {/* Cabecera ticket: fondo sutil + FACTURA + Cliente con icono */}
          <div className="shrink-0 bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold tracking-widest text-slate-900 dark:text-foreground">FACTURA</h2>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-white dark:bg-card border border-slate-200 dark:border-border rounded-full px-2.5 py-1 text-slate-600 dark:text-muted-foreground shadow-sm">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Consumidor Final
              </span>
            </div>
            {(cart.length > 0 || cartCombos.length > 0) && (
              vaciarConfirm ? (
                <Button size="sm" onClick={handleVaciar} className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-in fade-in">
                  <Trash2 className="h-3.5 w-3.5" />
                  ¿Seguro?
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleVaciar} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                  <Trash2 className="h-3.5 w-3.5" />
                  Vaciar
                </Button>
              )
            )}
          </div>
          <div className="shrink-0 sm:hidden px-4 py-2 border-b border-slate-200 dark:border-border bg-white dark:bg-card flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Consumidor Final
          </div>

          {/* Header tabular - Descripción con prioridad máxima, paddings reducidos */}
          <div className="shrink-0 grid grid-cols-[70px_1fr_58px_70px_24px] gap-1.5 px-3 py-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase bg-white dark:bg-card border-b border-slate-200 dark:border-border">
            <span className="text-center">Cant.</span>
            <span>Descripción</span>
            <span className="text-right">P. Unit</span>
            <span className="text-right">Subtotal</span>
            <span></span>
          </div>

          {/* Lista scrolleable - filas delgadas, 8-10 visibles sin scroll */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-card">
            {cart.length === 0 && cartCombos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-muted flex items-center justify-center mb-3">
                  <ShoppingCart className="h-7 w-7 text-slate-300 dark:text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-foreground">Sin productos en el ticket</p>
                <p className="text-xs text-slate-400 dark:text-muted-foreground mt-1">Presioná [Espacio] o clickeá un ítem para comenzar</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cartCombos.map((cc) => {
                  const promo = cc.promotion;
                  const linesDesc = promo.lines?.map(l => `${l.productName} x${l.quantity}`).join(" · ") ?? promo.products.map(p=>p.name).join(" · ");
                  const unit = promo.comboPrice ?? 0;
                  const sub = unit * cc.quantity;
                  const isExpanded = expandedCombos.has(promo.id);
                  return (
                    <div key={promo.id} className="bg-amber-50/40 dark:bg-amber-950/10">
                      <div className="grid grid-cols-[70px_1fr_58px_70px_24px] gap-1.5 items-center px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon-sm" className="h-6 w-6 rounded" onClick={() => decCombo(promo.id)}><Minus className="h-3 w-3" /></Button>
                          <span className="text-xs font-semibold w-6 text-center">{cc.quantity}</span>
                          <Button variant="outline" size="icon-sm" className="h-6 w-6 rounded" onClick={() => incCombo(promo.id)}><Plus className="h-3 w-3" /></Button>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] font-medium leading-tight break-words line-clamp-2" title={promo.name}>{promo.name}</span>
                            <span className="shrink-0 bg-secondary text-secondary-foreground border text-[9px] px-1 py-0.5 rounded font-bold tracking-wide">COMBO</span>
                            <button onClick={() => toggleExpand(promo.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
                              <ChevronDown className={`h-3 w-3 transition ${isExpanded?'rotate-180':''}`} />
                            </button>
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1 break-words" title={linesDesc}>{linesDesc}</div>
                        </div>
                        <span className="text-xs text-muted-foreground text-right">${unit.toLocaleString("es-AR")}</span>
                        <span className="text-sm font-bold text-right">${sub.toLocaleString("es-AR")}</span>
                        <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={() => removeCombo(promo.id)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                      {isExpanded && (
                        <div className="mx-3 mb-2 text-[11px] bg-card border rounded px-2 py-1.5 space-y-0.5">
                          {promo.lines?.map(l => (
                            <div key={l.productId} className="flex justify-between gap-2"><span className="truncate">{l.productName} ×{l.quantity}</span><span className="shrink-0">${l.lineTotal.toLocaleString("es-AR")}</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {cart.map((c) => {
                  const lineSub = c.unitPrice * c.quantity;
                  const isWeight = isWeightProduct(c.product);
                  const qtyDisplay = Number(c.quantity).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
                  return (
                    <div key={c.product.id} className="grid grid-cols-[70px_1fr_58px_70px_24px] gap-1.5 items-center px-2 py-2 hover:bg-muted/30">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="icon-sm" className="h-6 w-6 rounded" onClick={() => dec(c.product.id)} aria-label="Restar"><Minus className="h-3 w-3" /></Button>
                        {(c.product.isSoldByWeight || isWeight) ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={c.quantity}
                            onChange={(e) => setQty(c.product.id, e.target.value)}
                            className="w-10 text-center text-xs font-semibold bg-card border border-input rounded h-6 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <span className="text-xs font-semibold w-6 text-center">{qtyDisplay}</span>
                        )}
                        <Button variant="outline" size="icon-sm" className="h-6 w-6 rounded" onClick={() => inc(c.product.id)} aria-label="Sumar"><Plus className="h-3 w-3" /></Button>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium leading-tight break-words line-clamp-2" title={c.product.name}>{c.product.name}</div>
                        {discountMap.get(c.product.id) ? <span className="inline-block mt-0.5 text-[9px] px-1 py-0.5 rounded border bg-secondary font-bold tracking-wide">PROMO</span> : null}
                      </div>
                      <span className="text-xs text-muted-foreground text-right">${Number(c.unitPrice).toLocaleString("es-AR")}</span>
                      <span className="text-sm font-bold text-right">${Number(lineSub).toLocaleString("es-AR")}</span>
                      <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove(c.product.id)} aria-label="Quitar"><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bloque totales: fondo suave diferenciado, números alineados a derecha */}
          <div className="shrink-0 bg-slate-50 dark:bg-zinc-900/30 border-t border-slate-200 dark:border-border p-4 flex flex-col gap-2">
            <div className="flex flex-col gap-1.5 text-sm">
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-muted-foreground">Subtotal sueltos</span>
                    <span className="font-medium tabular-nums text-slate-900 dark:text-foreground">${subtotalNormal.toLocaleString("es-AR")}</span>
                  </div>
                  {cartCombos.length > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-muted-foreground">Combos ({cartCombos.reduce((s, c) => s + c.quantity, 0)} u.)</span>
                      <span className="font-medium tabular-nums text-slate-900 dark:text-foreground">${subtotalCombos.toLocaleString("es-AR")}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-emerald-700 dark:text-emerald-400">Descuento aplicado: <span className="font-mono tabular-nums">-${discountAmount.toLocaleString("es-AR")}</span></span>
                    <button
                      type="button"
                      onClick={() => setDiscountValue("0")}
                      className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-slate-100 dark:hover:bg-muted text-slate-500 hover:text-slate-700 dark:text-muted-foreground transition-colors"
                      aria-label="Quitar descuento"
                      title="Quitar descuento"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-muted-foreground uppercase">Total</span>
                <span className="font-bold text-2xl font-mono tabular-nums text-slate-900 dark:text-foreground">${total.toLocaleString("es-AR")}</span>
              </div>
            </div>

            <Button
              className="w-full mt-3 bg-red-600 hover:bg-red-700 active:scale-[0.99] transition-all text-white font-semibold shadow-sm py-3 rounded-xl text-sm"
              disabled={(cart.length === 0 && cartCombos.length===0) || saleLoading}
              onClick={() => {
                setSaleError(null);
                setIsCredit(false);
                setPaymentMethod(0);
                setCashPaid("");
                setCreditCustomerId("");
                setCustomerSearch("");
                setShowCheckout(true);
              }}
            >
            Cobrar ${total.toLocaleString("es-AR")}
          </Button>
          </div>
        </div>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCheckout(false)}>
          <div
            className="bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-md flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Confirmar venta</h3>
            <div className="rounded-xl bg-muted p-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total a cobrar</span>
              <span className="text-xl font-semibold">${total.toLocaleString("es-AR")}</span>
            </div>
            {(discountAmount > 0 || subtotalCombos>0) && (
              <p className="text-xs text-muted-foreground -mt-2">
                Sueltos ${subtotalNormal.toLocaleString("es-AR")} {discountAmount>0 && `- Descuento ${discountAmount.toLocaleString("es-AR")}`} {subtotalCombos>0 && `+ Combos ${subtotalCombos.toLocaleString("es-AR")}`}
              </p>
            )}

            {/* Descuento manual — trasladado desde pie de Factura */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 dark:bg-muted p-1 rounded-xl flex w-fit shrink-0">
                <button
                  type="button"
                  onClick={() => setDiscountType("%")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${discountType === "%" ? "bg-white dark:bg-card shadow-sm border border-slate-200 dark:border-border text-slate-900 dark:text-foreground" : "text-slate-600 dark:text-muted-foreground"}`}
                  aria-label="Porcentaje"
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("$")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${discountType === "$" ? "bg-white dark:bg-card shadow-sm border border-slate-200 dark:border-border text-slate-900 dark:text-foreground" : "text-slate-600 dark:text-muted-foreground"}`}
                  aria-label="Monto fijo"
                >
                  $
                </button>
              </div>
              <div className="relative flex-1">
                {discountType === "$" && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>}
                <Input
                  type="number"
                  step="0.01"
                  value={discountValue === "0" ? "" : discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "%" ? "Ej: 10" : "Ej: 500"}
                  className={`h-9 text-sm bg-background ${discountType === "$" ? "pl-7" : "pr-8"}`}
                />
                {discountType === "%" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>}
              </div>
              {discountValue !== "0" && discountValue !== "" && (parseFloat(discountValue) || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setDiscountValue("0")}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-muted text-slate-500 hover:text-slate-700 transition-colors shrink-0"
                  aria-label="Limpiar descuento"
                  title="Limpiar descuento"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {discountAmount > 0 && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 -mt-1">
                Descuento aplicado: <span className="font-mono tabular-nums">-${discountAmount.toLocaleString("es-AR")}</span> · Total a pagar <span className="font-mono tabular-nums">${total.toLocaleString("es-AR")}</span>
              </p>
            )}

            <div className={`grid gap-2 ${flags.moduloClientes ? "grid-cols-2" : "grid-cols-3"}`}>
              <Button
                variant={!isCredit && paymentMethod === 0 ? "default" : "outline"}
                className="rounded-full font-semibold"
                onClick={() => { setIsCredit(false); setPaymentMethod(0); setSaleError(null); }}
              >
                Efectivo
              </Button>
              <Button
                variant={!isCredit && paymentMethod === 1 ? "default" : "outline"}
                className="rounded-full font-semibold"
                onClick={() => { setIsCredit(false); setPaymentMethod(1); setSaleError(null); }}
              >
                MercadoPago / QR
              </Button>
              <Button
                variant={!isCredit && paymentMethod === 2 ? "default" : "outline"}
                className="rounded-full font-semibold"
                onClick={() => { setIsCredit(false); setPaymentMethod(2); setSaleError(null); }}
              >
                Débito/Crédito
              </Button>
              {flags.moduloClientes && (
                <Button
                  variant={isCredit ? "default" : "outline"}
                  className={`rounded-full font-semibold ${isCredit ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600" : ""}`}
                  onClick={() => { setIsCredit(true); setSaleError(null); }}
                >
                  Fiado / Cta. Cte.
                </Button>
              )}
            </div>
            {!flags.moduloClientes && (
              <div className="text-xs text-muted-foreground bg-slate-50 dark:bg-muted/40 border rounded-lg px-3 py-2 flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Cliente: <span className="font-medium text-foreground">Consumidor Final</span> — módulo Clientes deshabilitado
              </div>
            )}

            {/* Efectivo */}
            {!isCredit && paymentMethod === 0 && (
              <div className="flex flex-col gap-3 p-3 rounded-xl border bg-muted/30">
                <label className="text-sm font-medium">Pagó con $</label>
                <Input
                  ref={cashInputRef}
                  type="number"
                  min={0}
                  value={cashPaid}
                  onChange={(e) => setCashPaid(e.target.value)}
                  placeholder="$0"
                  className="bg-background text-lg font-semibold"
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" className="text-xs rounded-full" onClick={() => { setCashPaid(String(total)); setTimeout(()=>cashInputRef.current?.select(),0); }}>Monto exacto</Button>
                  {[1000,2000,5000,10000].map((delta) => (
                    <Button
                      key={delta}
                      variant="outline"
                      size="sm"
                      className="text-xs rounded-full"
                      onClick={() => {
                        setCashPaid(String(cashNum + delta));
                        setTimeout(() => { cashInputRef.current?.focus(); cashInputRef.current?.select(); }, 0);
                      }}
                    >
                      +${delta.toLocaleString("es-AR")}
                    </Button>
                  ))}
                </div>
                {cashNum >= total ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                    <p className="text-xs font-medium text-green-700 tracking-widest uppercase">Vuelto a entregar</p>
                    <p className="text-2xl font-black text-green-800 leading-none mt-1">${vuelto.toLocaleString("es-AR")}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                    <p className="text-xs font-medium text-amber-700 tracking-widest uppercase">Resta abonar</p>
                    <p className="text-xl font-bold text-amber-800 leading-none mt-1">${falta.toLocaleString("es-AR")}</p>
                    <p className="text-xs text-amber-600 mt-1">Ingresá ${falta.toLocaleString("es-AR")} más</p>
                  </div>
                )}
              </div>
            )}

            {/* MercadoPago / QR */}
            {!isCredit && paymentMethod === 1 && (
              <div className="rounded-lg border border-border bg-muted p-3 text-sm text-center">
                <p className="font-semibold">Total: ${total.toLocaleString("es-AR")}</p>
                <p className="text-muted-foreground text-xs mt-1">Se registrará como MercadoPago / QR.</p>
                <p className="text-xs text-muted-foreground mt-1">Presioná Enter para confirmar — Esc para cancelar.</p>
              </div>
            )}

            {/* Tarjeta Débito/Crédito */}
            {!isCredit && paymentMethod === 2 && (
              <div className="rounded-lg border border-border bg-muted p-3 text-sm text-center">
                <p className="font-semibold">Total: ${total.toLocaleString("es-AR")}</p>
                <p className="text-muted-foreground text-xs mt-1">Se registrará como Débito / Crédito.</p>
                <p className="text-xs text-muted-foreground mt-1">Presioná Enter para confirmar — Esc para cancelar.</p>
              </div>
            )}

            {/* Fiado — hidden when moduloClientes off */}
            {flags.moduloClientes && isCredit && (
              <div className="flex flex-col gap-2 p-3 rounded-xl border bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50">
                {!selectedCustomer ? (
                  showInlineCreate ? (
                    <div className="flex flex-col gap-2 p-2 rounded-md border bg-card">
                      <Label className="text-sm font-medium">Nuevo cliente</Label>
                      <Input placeholder="Nombre" value={inlineName} onChange={(e) => setInlineName(e.target.value)} autoFocus />
                      <Input placeholder="Teléfono (opcional)" value={inlinePhone} onChange={(e) => setInlinePhone(e.target.value)} />
                      {inlineError && <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded p-1">{inlineError}</p>}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowInlineCreate(false); setInlineError(null); }}>Cancelar</Button>
                        <Button size="sm" className="flex-1" onClick={handleInlineCreate} disabled={inlineLoading}>
                          {inlineLoading ? "Creando…" : "Guardar y seleccionar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Label className="text-sm">Buscar cliente *</Label>
                      <Input ref={fiadoSearchRef} placeholder="Buscar por nombre, DNI o teléfono..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="bg-card" />
                      <div className="max-h-40 overflow-auto border rounded-md bg-card divide-y">
                        {customerSearchResults.length > 0 ? (
                          <>
                            {customerSearchResults.map((c) => (
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
                                {c.balance > 0 && <span className="ml-2 text-xs font-semibold text-red-600">Debe ${Number(c.balance).toLocaleString("es-AR")}</span>}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setInlineName(customerSearch.trim());
                                setInlinePhone("");
                                setInlineError(null);
                                setShowInlineCreate(true);
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-primary/10 text-sm font-medium text-primary border-t bg-muted/20"
                            >
                              + Crear cliente nuevo
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground p-2 text-center">Sin resultados</p>
                            <button
                              onClick={() => {
                                setInlineName(customerSearch.trim());
                                setInlinePhone("");
                                setInlineError(null);
                                setShowInlineCreate(true);
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-primary/10 text-sm font-medium text-primary border-t bg-muted/20"
                            >
                              + Crear cliente nuevo
                            </button>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Seleccioná un cliente para confirmar fiado.</p>
                    </>
                  )
                ) : (
                  <>
                    <div className="flex justify-between items-center p-2 rounded-lg border bg-card">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-sm">{selectedCustomer.name}</span>
                        {selectedCustomer.phone && <span className="text-xs text-muted-foreground">{selectedCustomer.phone}</span>}
                        {selectedCustomer.balance > 0 ? (
                          <span className="text-xs font-semibold text-red-600">Debe ${Number(selectedCustomer.balance).toLocaleString("es-AR")}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin deuda</span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setCreditCustomerId(""); setCustomerSearch(""); }} title="Cambiar cliente">
                        <X className="h-4 w-4 mr-1" /> Cambiar
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

            {isCredit && selectedCustomer && <p className="text-xs text-muted-foreground bg-muted border border-border rounded p-2">Venta fiada — no hay vuelto. Quedará pendiente para {selectedCustomer.name}. {dueDateHint ? `Vence ${dueDateHint}.` : ""}</p>}

            {saleError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{saleError}</div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowCheckout(false)} disabled={saleLoading}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmSale}
                disabled={saleLoading || (isCredit ? !creditCustomerId : paymentMethod === 0 && cashNum < total)}
                className="bg-red-600 hover:bg-red-700 text-white min-w-[140px]"
              >
                {saleLoading ? "Procesando…" : "Confirmar venta"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



