"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, PackagePlus, Tag, Pencil, Search, X, History, AlertTriangle, Plus, Trash2, TrendingUp, TrendingDown, Percent, MoreHorizontal } from "lucide-react";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useFeatureGuard } from "@/hooks/useFeatureGuard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import CategoryFormModal from "@/components/Categorias/CategoryFormModal";
import NewProductModal from "@/components/Inventario/NewProductModal";
import {
  getProducts,
  adjustStock,
  deleteProduct,
  updateProduct,
  getStockAudits,
  getProductPriceHistory,
  getCategories,
  getCategoryProducts,
  assignCategory,
  removeCategory,
  deleteCategory,
  bulkAdjustPrices,
  uploadProductImage,
  API_URL,
  ProductDto,
  ApiError,
  CategoryDto,
  StockAuditDto,
  ProductPriceHistoryDto,
} from "@/lib/api";

function formatReason(reason: string | null | undefined): string {
  if (!reason) return "Cambio de precio";
  const trimmed = reason.trim();
  if (!trimmed) return "Cambio de precio";
  const uuidSingle = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const uuidGlobal = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const saleWithUuid = /Sale\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = trimmed.match(uuidSingle);
  if (saleWithUuid.test(trimmed) && match) {
    return `Venta en mostrador #${match[0].slice(-4)}`;
  }
  if (match) {
    let cleaned = trimmed.replace(/Sale\s*/i, "").trim();
    cleaned = cleaned.replace(uuidGlobal, (m) => ` #${m.slice(-4)}`);
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
    if (/^#[\da-f]{3,4}$/i.test(cleaned)) {
      return `Venta en mostrador ${cleaned}`;
    }
    if (!cleaned) {
      return `Venta en mostrador #${match[0].slice(-4)}`;
    }
    if (trimmed.toLowerCase().includes("sale") && cleaned.length <= 5) {
      return `Venta en mostrador #${match[0].slice(-4)}`;
    }
    return cleaned;
  }
  return trimmed;
}

function InventarioPageContent() {
  const { allowed } = useFeatureGuard({ denyRoles: ["SuperAdmin"], redirectTo: "/Admin/Negocios" });
  const router = useRouter();
  const searchParams = useSearchParams();
  const { flags } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<"productos" | "categorias">("productos");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "categorias") setActiveTab("categorias");
    else setActiveTab("productos");
  }, [searchParams]);

  const handleTabChange = (tab: "productos" | "categorias") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "categorias") params.set("tab", "categorias");
    else params.delete("tab");
    const qs = params.toString();
    router.replace(qs ? `/Inventario?${qs}` : "/Inventario");
  };

  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Categories state (shared)
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [productCategories, setProductCategories] = useState<Record<string, CategoryDto[]>>({});
  const [productCatLoading, setProductCatLoading] = useState(false);

  const [catActionError, setCatActionError] = useState<string | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDto | null>(null);
  const [catModalOrigin, setCatModalOrigin] = useState<"general" | "drawer" | "tab">("general");

  // Categorias tab specific
  const [catSearchTerm, setCatSearchTerm] = useState("");
  const [catBannerSuccess, setCatBannerSuccess] = useState<string | null>(null);
  const [catBannerError, setCatBannerError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "inStock" | "low" | "out">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc">("name_asc");

  // Deep-link: ?filter=lowStock desde la campana
  useEffect(() => {
    if (searchParams.get("filter") === "lowStock") setStockFilter("low");
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [searchParams]);

  // Drawer / selected product
  const [selectedProduct, setSelectedProduct] = useState<ProductDto | null>(null);
  const [audits, setAudits] = useState<StockAuditDto[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [auditsError, setAuditsError] = useState<string | null>(null);

  // Price history tab (kept for compat, kardex now uses drawerKardexFilter)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [priceHistoryTab, setPriceHistoryTab] = useState<"stock" | "precios">("stock");
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistoryDto[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);

  // Drawer tabs: Datos y Precios vs Historial y Stock
  const [drawerTab, setDrawerTab] = useState<"datos" | "historial">("datos");
  const [drawerKardexFilter, setDrawerKardexFilter] = useState<"todos" | "stock" | "precios">("todos");
  const [drawerDelta, setDrawerDelta] = useState<string>("1");
  const [drawerReason, setDrawerReason] = useState<string>("Ajuste manual");
  const [drawerAdjustLoading, setDrawerAdjustLoading] = useState(false);
  const [drawerAdjustError, setDrawerAdjustError] = useState<string | null>(null);
  const [drawerDeleteConfirm, setDrawerDeleteConfirm] = useState(false);
  const [drawerConfirmOpen, setDrawerConfirmOpen] = useState(false);
  const [drawerConfirmSign, setDrawerConfirmSign] = useState<1 | -1>(1);
  const [drawerConfirmAmount, setDrawerConfirmAmount] = useState<number>(0);

  // quick edit inside drawer
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [editProduct, setEditProduct] = useState<ProductDto | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [quickUnit, setQuickUnit] = useState<"un" | "kg" | "">("");
  const [quickMinStock, setQuickMinStock] = useState("");
  const [quickImageUrl, setQuickImageUrl] = useState("");
  const [quickSelectedFile, setQuickSelectedFile] = useState<File | null>(null);
  const [quickPreviewUrl, setQuickPreviewUrl] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickSuccess, setQuickSuccess] = useState<string | null>(null);
  const [assignCatId, setAssignCatId] = useState<string>("");

  useEffect(() => {
    return () => {
      if (quickPreviewUrl) URL.revokeObjectURL(quickPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickPreviewUrl]);

  // Nuevo Producto modal state
  const [showNewProduct, setShowNewProduct] = useState(false);

  // Bulk price adjustment state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("all");
  const [bulkMode, setBulkMode] = useState<"percent" | "fixed">("percent");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [bulkReason, setBulkReason] = useState<string>("");
  const [bulkRounding, setBulkRounding] = useState<"none" | "10" | "50">("none");
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

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

  const fetchCategoriesInternal = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const data = await getCategories();
      setCategories(data);
      return data;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar categorías";
      setCatError(msg);
      return [];
    } finally {
      setCatLoading(false);
    }
  }, []);

  const rebuildProductCategories = useCallback(async (cats: CategoryDto[]) => {
    if (cats.length === 0) {
      setProductCategories({});
      return;
    }
    setProductCatLoading(true);
    try {
      const results = await Promise.all(
        cats.map(async (c) => {
          try {
            const prods = await getCategoryProducts(c.id);
            return { cat: c, prods };
          } catch {
            return { cat: c, prods: [] as ProductDto[] };
          }
        })
      );
      const map: Record<string, CategoryDto[]> = {};
      results.forEach(({ cat, prods }) => {
        prods.forEach((p) => {
          if (!map[p.id]) map[p.id] = [];
          const canonical = cats.find((x) => x.id === cat.id) ?? cat;
          map[p.id].push(canonical);
        });
      });
      setProductCategories(map);
    } finally {
      setProductCatLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
    void fetchCategoriesInternal().then((cats) => {
      void rebuildProductCategories(cats);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [fetchProducts, fetchCategoriesInternal, rebuildProductCategories]);

  const refreshCategoriesAndMap = useCallback(async () => {
    const cats = await fetchCategoriesInternal();
    await rebuildProductCategories(cats);
    return cats;
  }, [fetchCategoriesInternal, rebuildProductCategories]);

  // Bulk helpers
  const bulkFilteredByCategory = useMemo(() => {
    if (bulkCategoryId === "all") return products.filter((p) => true);
    return products.filter((p) => (productCategories[p.id] ?? []).some((c) => c.id === bulkCategoryId));
  }, [products, productCategories, bulkCategoryId]);

  const round2Away = (v: number) => Math.sign(v) * Math.round(Math.abs(v) * 100) / 100;

  const bulkPreview = useMemo(() => {
    const val = parseFloat(bulkValue);
    const hasAdjustment = !isNaN(val) && val !== 0;
    return bulkFilteredByCategory.map((p) => {
      const oldPrice = p.price;
      let newPrice = oldPrice;
      if (hasAdjustment) {
        if (bulkMode === "percent") {
          newPrice = round2Away(oldPrice * (1 + val / 100));
        } else {
          newPrice = round2Away(oldPrice + val);
        }
        if (newPrice < 0) newPrice = 0;
        if (bulkRounding !== "none") {
          const step = bulkRounding === "10" ? 10 : 50;
          newPrice = Math.round(newPrice / step) * step;
          newPrice = round2Away(newPrice);
        }
      }
      const changePercent = oldPrice === 0 ? 0 : ((newPrice - oldPrice) / oldPrice) * 100;
      return { id: p.id, sku: p.sku, name: p.name, oldPrice, newPrice, changePercent };
    });
  }, [bulkFilteredByCategory, bulkValue, bulkMode, bulkRounding]);

  const bulkPreviewFiltered = useMemo(() => {
    return bulkPreview.filter((b) => bulkSelected[b.id] !== false);
  }, [bulkPreview, bulkSelected]);

  const bulkAllChecked = bulkPreview.length > 0 && bulkPreview.every((b) => bulkSelected[b.id] !== false);
  const bulkHasAdjustment = (() => {
    const val = parseFloat(bulkValue);
    return !isNaN(val) && val !== 0;
  })();

  const openBulk = () => {
    const init: Record<string, boolean> = {};
    const filtered = bulkCategoryId === "all" ? products : products.filter((p) => (productCategories[p.id] ?? []).some((c) => c.id === bulkCategoryId));
    filtered.forEach((p) => (init[p.id] = true));
    setBulkSelected(init);
    setBulkError(null);
    setBulkSuccess(null);
    setShowBulk(true);
  };

  useEffect(() => {
    if (!showBulk) return;
    const filtered = bulkFilteredByCategory;
    setBulkSelected((prev) => {
      const next: Record<string, boolean> = {};
      filtered.forEach((p) => {
        next[p.id] = prev[p.id] ?? true;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkCategoryId, showBulk, bulkFilteredByCategory.length]);

  const handleBulkConfirm = async () => {
    const val = parseFloat(bulkValue);
    const percentage = bulkMode === "percent" && !isNaN(val) && val !== 0 ? val : null;
    const fixedAmount = bulkMode === "fixed" && !isNaN(val) && val !== 0 ? val : null;
    const reasonTrim = bulkReason.trim();
    if (reasonTrim.length > 500) {
      setBulkError("Motivo no puede exceder 500 caracteres");
      return;
    }
    let effectiveReason = reasonTrim;
    if (effectiveReason.length === 0) {
      const dateStr = new Date().toLocaleDateString("es-AR");
      if (percentage !== null) {
        effectiveReason = `Aumento inflación ${val > 0 ? "+" : ""}${val}%`;
      } else if (fixedAmount !== null) {
        effectiveReason = `Ajuste general ${dateStr}`;
      } else {
        effectiveReason = `Ajuste general ${dateStr}`;
      }
    }
    if (percentage === null && fixedAmount === null) {
      setBulkError("Ingresá un valor distinto de 0");
      return;
    }
    if (percentage !== null && (percentage < -90 || percentage > 500)) {
      setBulkError("Porcentaje debe estar entre -90 y 500");
      return;
    }
    if (fixedAmount !== null && (fixedAmount < -1_000_000 || fixedAmount > 1_000_000)) {
      setBulkError("Monto fijo debe estar entre -1000000 y 1000000");
      return;
    }
    const selectedIds = bulkPreviewFiltered.map((b) => b.id);
    if (selectedIds.length === 0) {
      setBulkError("No hay productos seleccionados");
      return;
    }
    setBulkLoading(true);
    setBulkError(null);
    setBulkSuccess(null);
    try {
      const rounding = bulkRounding === "none" ? null : Number(bulkRounding);
      const result = await bulkAdjustPrices({
        categoryId: null,
        productIds: selectedIds,
        percentage,
        fixedAmount,
        reason: effectiveReason,
        rounding,
      });
      setBulkSuccess(`Ajuste aplicado a ${result.affectedCount} productos`);
      await fetchProducts();
      await refreshCategoriesAndMap();
      if (selectedProduct) {
        try {
          const res = await getProductPriceHistory(selectedProduct.id, { pageSize: 20 });
          setPriceHistory(res.items);
          setPriceHistoryTab("precios");
        } catch {}
      }
      setTimeout(() => {
        setShowBulk(false);
        setBulkSuccess(null);
      }, 1200);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al ajustar precios";
      setBulkError(msg);
    } finally {
      setBulkLoading(false);
    }
  };

  useEffect(() => {
    if (!catBannerSuccess) return;
    const t = setTimeout(() => setCatBannerSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [catBannerSuccess]);

  useEffect(() => {
    if (!selectedProduct) {
      setAudits([]);
      setAuditsError(null);
      setPriceHistory([]);
      setPriceHistoryError(null);
      return;
    }
    let cancelled = false;
    const fetchAudits = async () => {
      setAuditsLoading(true);
      setAuditsError(null);
      try {
        const res = await getStockAudits({ productId: selectedProduct.id, pageSize: 20 });
        if (!cancelled) setAudits(res.items);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar historial";
          setAuditsError(msg);
        }
      } finally {
        if (!cancelled) setAuditsLoading(false);
      }
    };
    const fetchPriceHistory = async () => {
      setPriceHistoryLoading(true);
      setPriceHistoryError(null);
      try {
        const res = await getProductPriceHistory(selectedProduct.id, { pageSize: 20 });
        if (!cancelled) setPriceHistory(res.items);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar historial de precios";
          setPriceHistoryError(msg);
        }
      } finally {
        if (!cancelled) setPriceHistoryLoading(false);
      }
    };
    void fetchAudits();
    void fetchPriceHistory();
    setPriceHistoryTab("stock");
    setDrawerTab("datos");
    setDrawerKardexFilter("todos");
    setDrawerDelta("1");
    setDrawerReason("Ajuste manual");
    setDrawerAdjustError(null);
    setDrawerDeleteConfirm(false);
    setEditProduct(null);
    setQuickName(selectedProduct.name);
    setQuickPrice(String(selectedProduct.price));
    setQuickDesc(selectedProduct.description ?? "");
    const normUnit = (selectedProduct.unit ?? "").toLowerCase().trim();
    if (normUnit === "kg" || normUnit === "granel") setQuickUnit("kg");
    else setQuickUnit("un");
    setQuickMinStock(selectedProduct.minStock != null ? String(selectedProduct.minStock) : "");
    setQuickImageUrl(selectedProduct.imageUrl ?? "");
    setQuickSelectedFile(null);
    if (quickPreviewUrl) URL.revokeObjectURL(quickPreviewUrl);
    setQuickPreviewUrl(null);
    setQuickError(null);
    setQuickSuccess(null);
    setAssignCatId("");
    return () => {
      cancelled = true;
    };
  }, [selectedProduct]);

  const totalValue = useMemo(() => products.reduce((acc, p) => acc + p.price * p.stock, 0), [products]);
  const totalProducts = products.length;
  const lowStockCount = useMemo(() => products.filter((p) => p.stock > 0 && p.stock <= (p.minStock ?? 5)).length, [products]);
  const outOfStockCount = useMemo(() => products.filter((p) => p.stock <= 0).length, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (selectedCategoryId !== "all") {
      result = result.filter((p) => (productCategories[p.id] ?? []).some((c) => c.id === selectedCategoryId));
    }
    if (stockFilter === "low") {
      result = result.filter((p) => p.stock > 0 && p.stock <= (p.minStock ?? 5));
    } else if (stockFilter === "out") {
      result = result.filter((p) => p.stock <= 0);
    } else if (stockFilter === "inStock") {
      result = result.filter((p) => p.stock > (p.minStock ?? 5));
    }
    switch (sortBy) {
      case "name_asc":
        result.sort((a, b) => a.name.localeCompare(b.name, "es"));
        break;
      case "name_desc":
        result.sort((a, b) => b.name.localeCompare(a.name, "es"));
        break;
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "stock_asc":
        result.sort((a, b) => a.stock - b.stock);
        break;
      case "stock_desc":
        result.sort((a, b) => b.stock - a.stock);
        break;
    }
    return result;
  }, [products, search, selectedCategoryId, productCategories, stockFilter, sortBy]);

  const clearFilters = () => {
    setSearch("");
    setSelectedCategoryId("all");
    setStockFilter("all");
    setSortBy("name_asc");
  };

  const hasActiveFilters = search !== "" || selectedCategoryId !== "all" || stockFilter !== "all" || sortBy !== "name_asc";

  const handleDelete = async (product: ProductDto) => {
    if (!confirm(`¿Eliminar ${product.name} (${product.sku})? Se hará soft-delete.`)) return;
    try {
      await deleteProduct(product.id);
      if (selectedProduct?.id === product.id) setSelectedProduct(null);
      await fetchProducts();
      await refreshCategoriesAndMap();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al eliminar";
      alert(msg);
    }
  };

  const handleAssign = async (product: ProductDto, categoryId: string) => {
    setCatActionError(null);
    try {
      await assignCategory(product.id, categoryId);
      await refreshCategoriesAndMap();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al asignar categoría";
      setCatActionError(msg);
    }
  };

  const handleRemove = async (product: ProductDto, categoryId: string) => {
    setCatActionError(null);
    try {
      await removeCategory(product.id, categoryId);
      await refreshCategoriesAndMap();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al quitar categoría";
      setCatActionError(msg);
    }
  };

  const handleDrawerAssign = async () => {
    if (!selectedProduct || !assignCatId) return;
    await handleAssign(selectedProduct, assignCatId);
    setAssignCatId("");
  };

  const handleDrawerStockAdjust = (sign: 1 | -1) => {
    if (!selectedProduct) return;
    const raw = drawerDelta.replace(",", ".").trim();
    const qty = parseFloat(raw);
    if (!raw || !Number.isFinite(qty) || qty === 0) {
      setDrawerAdjustError("Cantidad debe ser mayor a 0");
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setDrawerAdjustError("Cantidad debe ser mayor a 0");
      return;
    }
    if (Math.round(qty * 1000) / 1000 !== qty) {
      setDrawerAdjustError("Cantidad no puede tener más de 3 decimales");
      return;
    }
    const isWeightDrawerAdj = selectedProduct.isSoldByWeight === true || (selectedProduct.unit ?? "").toLowerCase() === "kg";
    if (!isWeightDrawerAdj && !Number.isInteger(qty)) {
      setDrawerAdjustError("Para productos por unidad la cantidad debe ser entera");
      return;
    }
    if (!drawerReason.trim() || drawerReason.trim().length > 250) {
      setDrawerAdjustError("Motivo requerido (1..250 caracteres)");
      return;
    }
    setDrawerConfirmSign(sign);
    setDrawerConfirmAmount(qty);
    setDrawerConfirmOpen(true);
    setDrawerAdjustError(null);
  };

  const confirmDrawerStockAdjust = async () => {
    if (!selectedProduct) return;
    const qty = drawerConfirmAmount;
    const sign = drawerConfirmSign;
    const deltaNum = sign * qty;
    setDrawerAdjustLoading(true);
    setDrawerAdjustError(null);
    try {
      await adjustStock(selectedProduct.id, { delta: deltaNum, reason: drawerReason.trim() || "Ajuste manual" });
      await fetchProducts();
      try {
        const fresh = await getProducts();
        setProducts(fresh);
        const found = fresh.find((p) => p.id === selectedProduct.id);
        if (found) setSelectedProduct(found);
      } catch {}
      try {
        const res = await getStockAudits({ productId: selectedProduct.id, pageSize: 20 });
        setAudits(res.items);
      } catch {}
      try {
        const res2 = await getProductPriceHistory(selectedProduct.id, { pageSize: 20 });
        setPriceHistory(res2.items);
      } catch {}
      setDrawerDelta("1");
      setDrawerConfirmOpen(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al ajustar stock";
      setDrawerAdjustError(msg);
      setDrawerConfirmOpen(false);
    } finally {
      setDrawerAdjustLoading(false);
    }
  };

  const kardexMerged = useMemo(() => {
    type KardexStock = { id: string; date: string; type: "stock"; reason: string; delta: number; resultingStock: number };
    type KardexPrice = { id: string; date: string; type: "price"; reason: string | null; oldPrice: number; newPrice: number; changePercent: number };
    const stockEntries: KardexStock[] = audits.map((a) => ({
      id: `s-${a.id}`,
      date: a.adjustedAt,
      type: "stock",
      reason: a.reason,
      delta: a.delta,
      resultingStock: a.resultingStock,
    }));
    const priceEntries: KardexPrice[] = priceHistory.map((h) => ({
      id: `p-${h.id}`,
      date: h.changedAt,
      type: "price",
      reason: h.reason,
      oldPrice: h.oldPrice,
      newPrice: h.newPrice,
      changePercent: h.changePercent,
    }));
    const merged: (KardexStock | KardexPrice)[] = [...stockEntries, ...priceEntries];
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (drawerKardexFilter === "stock") return merged.filter((e) => e.type === "stock");
    if (drawerKardexFilter === "precios") return merged.filter((e) => e.type === "price");
    return merged;
  }, [audits, priceHistory, drawerKardexFilter]);

  const handleQuickSave = async () => {
    if (!selectedProduct) return;
    setQuickError(null);
    setQuickSuccess(null);
    const name = quickName.trim();
    const priceNum = Number(quickPrice);
    const desc = quickDesc.trim() || null;
    if (!name) {
      setQuickError("Nombre requerido");
      return;
    }
    if (name.length > 50) {
      setQuickError("Nombre no puede exceder 50 caracteres");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setQuickError("Precio debe ser >= 0");
      return;
    }
    if (desc && desc.length > 500) {
      setQuickError("Descripción no puede exceder 500 caracteres");
      return;
    }
    const resolvedUnit = (quickUnit || "").toLowerCase().trim();
    if (resolvedUnit !== "un" && resolvedUnit !== "kg") {
      setQuickError("La unidad debe ser 'un' o 'kg'");
      return;
    }
    const isKgQuick = resolvedUnit === "kg";
    let minStockNum: number | null | undefined = undefined;
    if (quickMinStock.trim() !== "") {
      const v = parseFloat(quickMinStock.replace(",", "."));
      if (isNaN(v) || v < 0 || v > 99999) {
        setQuickError("Stock mínimo debe estar entre 0 y 99999");
        return;
      }
      if (isKgQuick) {
        if (Math.round(v * 1000) / 1000 !== v) {
          setQuickError("Stock mínimo a granel no puede tener más de 3 decimales");
          return;
        }
      } else if (!Number.isInteger(v)) {
        setQuickError("Stock mínimo por unidad debe ser entero");
        return;
      }
      minStockNum = v;
    } else {
      minStockNum = null;
    }
    setQuickLoading(true);
    try {
      const imageUrlToSend = quickSelectedFile ? undefined : (quickImageUrl.trim() || null);
      const dto: any = { name, price: priceNum, description: desc };
      if (resolvedUnit !== (selectedProduct.unit ?? "")) dto.unit = resolvedUnit || null;
      else dto.unit = selectedProduct.unit ?? null;
      if (minStockNum !== undefined) dto.minStock = minStockNum;
      if (imageUrlToSend !== undefined) dto.imageUrl = imageUrlToSend;
      else dto.imageUrl = selectedProduct.imageUrl ?? null;
      if (quickSelectedFile) dto.imageUrl = selectedProduct.imageUrl ?? null;
      await updateProduct(selectedProduct.id, dto);
      if (quickSelectedFile) {
        if (quickSelectedFile.size > 5*1024*1024) { setQuickError("Producto actualizado, pero falló subir imagen: Archivo muy grande (máximo 5MB)"); }
        else if (quickSelectedFile.type && !quickSelectedFile.type.startsWith("image/")) { setQuickError("Producto actualizado, pero falló subir imagen: Formato no soportado (solo imágenes)"); }
        else {
          try {
            const res = await uploadProductImage(selectedProduct.id, quickSelectedFile);
            dto.imageUrl = res.imageUrl;
          } catch (upErr) {
            const msg = upErr instanceof ApiError ? upErr.message : upErr instanceof Error ? upErr.message : "Error al subir imagen";
            setQuickError(`Producto actualizado, pero falló subir imagen: ${msg}`);
          }
        }
      }
      setQuickSuccess("Producto actualizado");
      await fetchProducts();
      const updatedDto: ProductDto = {
        ...selectedProduct,
        name,
        price: priceNum,
        description: desc,
        unit: resolvedUnit || null,
        minStock: minStockNum,
        imageUrl: dto.imageUrl ?? selectedProduct.imageUrl ?? null,
      };
      setSelectedProduct(updatedDto);
      if (quickSelectedFile && quickPreviewUrl) {
        URL.revokeObjectURL(quickPreviewUrl);
        setQuickPreviewUrl(null);
        setQuickSelectedFile(null);
      }
      if (priceNum !== selectedProduct.price) {
        try {
          const res = await getProductPriceHistory(selectedProduct.id, { pageSize: 20 });
          setPriceHistory(res.items);
          setPriceHistoryTab("precios");
        } catch {}
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al guardar";
      setQuickError(msg);
    } finally {
      setQuickLoading(false);
    }
  };

  const handleCategoryCreated = async (cat: CategoryDto) => {
    const origin = catModalOrigin;
    const isEdit = !!editingCategory;
    if (origin === "drawer" && selectedProduct) {
      await refreshCategoriesAndMap();
      try {
        await assignCategory(selectedProduct.id, cat.id);
      } catch {}
      try {
        const fresh = await getCategories();
        await rebuildProductCategories(fresh);
        setCategories(fresh);
      } catch {}
      setAssignCatId(cat.id);
    } else {
      const cats = await refreshCategoriesAndMap();
      if (origin === "tab") {
        setCatBannerSuccess(`Categoría "${cat.name}" ${isEdit ? "actualizada" : "creada"}`);
        setCatBannerError(null);
      }
      void cats;
    }
  };

  const closeCatModal = () => {
    setShowCatModal(false);
    setEditingCategory(null);
  };

  const openCreateFromTab = () => {
    setEditingCategory(null);
    setCatModalOrigin("tab");
    setShowCatModal(true);
  };

  const openEditFromTab = (cat: CategoryDto) => {
    setEditingCategory(cat);
    setCatModalOrigin("tab");
    setShowCatModal(true);
  };

  const confirmDeleteCat = (cat: CategoryDto) => {
    setDeleteConfirmId(cat.id);
    setDeleteError(null);
  };

  const handleDeleteCategory = async () => {
    if (!deleteConfirmId) return;
    const cat = categories.find((c) => c.id === deleteConfirmId);
    setDeleteLoading(true);
    setDeleteError(null);
    setCatBannerError(null);
    try {
      await deleteCategory(deleteConfirmId);
      setCatBannerSuccess(`Categoría "${cat?.name ?? ""}" desactivada`);
      setDeleteConfirmId(null);
      await refreshCategoriesAndMap();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al eliminar";
      const is409 = e instanceof ApiError && e.status === 409;
      if (is409) {
        const count = cat?.productCount ?? 0;
        const detail =
          count > 0
            ? `Tiene ${count} producto${count === 1 ? "" : "s"} activo${count === 1 ? "" : "s"}, quitá los productos de la categoría primero.`
            : msg;
        setDeleteError(detail);
        setCatBannerError(detail);
      } else {
        setDeleteError(msg);
        setCatBannerError(msg);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    const q = catSearchTerm.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q));
  }, [categories, catSearchTerm]);

  const deleteTarget = deleteConfirmId ? categories.find((c) => c.id === deleteConfirmId) : null;
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);

  const selectedCats = selectedProduct ? productCategories[selectedProduct.id] ?? [] : [];
  const unassignedCats = activeCategories.filter((c) => !selectedCats.some((sc) => sc.id === c.id));

  if (!allowed) {
    return <main className="w-full p-4 text-sm text-muted-foreground">Redirigiendo a /Admin/Negocios…</main>;
  }

  return (
    <main className="w-full min-w-0 max-w-none p-3 flex flex-col gap-4 bg-background text-foreground sm:gap-6 sm:p-4">
      {/* 1. Cabecera y Jerarquía de Acciones */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventario</h1>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
            <button
              onClick={() => handleTabChange("productos")}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 lg:min-h-0 ${activeTab === "productos" ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Package className="h-4 w-4" />
              Productos
              <span className={`ml-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${activeTab === "productos" ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900" : "bg-white border border-border text-muted-foreground"}`}>
                {products.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange("categorias")}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 lg:min-h-0 ${activeTab === "categorias" ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Tag className="h-4 w-4" />
              Categorías
              <span className={`ml-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${activeTab === "categorias" ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900" : "bg-white border border-border text-muted-foreground"}`}>
                {categories.length}
              </span>
            </button>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0">
          {activeTab === "productos" && (
            <>
              {flags.permitirAjusteInflacion && (
                <Button
                  onClick={openBulk}
                  className="min-h-11 w-full gap-2 border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 shadow-sm hover:bg-slate-50 sm:w-auto lg:min-h-0"
                  variant="outline"
                >
                  <Percent className="h-4 w-4" />
                  Ajuste de Precios / Inflación
                </Button>
              )}
              <Button
                onClick={() => setShowNewProduct(true)}
                className="min-h-11 w-full gap-2 bg-red-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-red-700 sm:w-auto lg:min-h-0"
              >
                <PackagePlus className="h-4 w-4" />
                Nuevo Producto
              </Button>
            </>
          )}
        </div>
      </div>

      {activeTab === "productos" ? (
        <>
          {/* 2. KPIs / Métricas en Fila */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm rounded-xl p-4 sm:p-5 flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground tracking-wider uppercase">Total de Productos</span>
              <span className="text-xl font-bold text-slate-900 dark:text-foreground tabular-nums sm:text-2xl">{totalProducts}</span>
              <span className="text-xs text-slate-500 dark:text-muted-foreground">SKUs activos</span>
            </div>
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm rounded-xl p-4 sm:p-5 flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground tracking-wider uppercase">Valor Total de Stock</span>
              <span className="text-xl font-bold text-slate-900 dark:text-foreground font-mono tabular-nums sm:text-2xl">${totalValue.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              <span className="text-xs text-slate-500 dark:text-muted-foreground">Valorizado a precio de venta</span>
            </div>
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm rounded-xl p-4 sm:p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground tracking-wider uppercase">Stock Crítico / Bajo</span>
                {lowStockCount > 0 && <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2 py-0.5 rounded-full">{lowStockCount}</span>}
              </div>
              <span className="text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums sm:text-2xl">{lowStockCount}</span>
              <span className="text-xs text-slate-500 dark:text-muted-foreground">Por debajo del mínimo</span>
            </div>
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm rounded-xl p-4 sm:p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground tracking-wider uppercase">Sin Stock</span>
                {outOfStockCount > 0 && <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-2 py-0.5 rounded-full">{outOfStockCount}</span>}
              </div>
              <span className="text-xl font-bold text-red-700 dark:text-red-400 tabular-nums sm:text-2xl">{outOfStockCount}</span>
              <span className="text-xs text-slate-500 dark:text-muted-foreground">0 unidades</span>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex justify-between items-center">
              <span>{error}</span>
                <Button variant="outline" size="sm" onClick={fetchProducts} className="h-11 sm:h-8">
                Reintentar
              </Button>
            </div>
          )}

          {/* 3. Filtros y Búsqueda - Barra unificada */}
          <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm rounded-xl p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative w-full min-w-0 flex-1 lg:min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 bg-slate-50 dark:bg-muted/40 border-slate-200 dark:border-border rounded-xl text-sm placeholder:text-slate-400 focus:bg-white dark:focus:bg-card focus:border-slate-300 transition-colors lg:h-10"
              />
            </div>

            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="w-full lg:w-[180px] h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm lg:h-10">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {activeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.productCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {catError && (
              <span className="text-xs text-red-600 border border-red-200 bg-red-50 rounded px-2 py-1">{catError}</span>
            )}

            <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as typeof stockFilter)}>
              <SelectTrigger className="w-full lg:w-[180px] h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm lg:h-10">
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="inStock">Con stock</SelectItem>
                <SelectItem value="low">Stock bajo</SelectItem>
                <SelectItem value="out">Sin stock (0)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-full lg:w-[200px] h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm lg:h-10">
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nombre A-Z</SelectItem>
                <SelectItem value="name_desc">Nombre Z-A</SelectItem>
                <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
                <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
                <SelectItem value="stock_asc">Stock: menor a mayor</SelectItem>
                <SelectItem value="stock_desc">Stock: mayor a menor</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-11 w-full gap-1 rounded-xl sm:w-auto lg:h-8">
                <X className="h-3.5 w-3.5" /> Limpiar
              </Button>
            )}
          </div>

          {catActionError && <p className="text-sm text-amber-700 border border-amber-200 bg-amber-50 rounded p-2">{catActionError}</p>}

          {/* 4. Tabla de Productos Profesional */}
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-border dark:bg-card">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200/60 dark:border-border bg-white dark:bg-card">
              <h3 className="text-sm font-semibold text-foreground">
                Productos <span className="text-sm font-normal text-muted-foreground">({filteredProducts.length}/{products.length})</span>
                {productCatLoading && <span className="text-xs ml-2 text-muted-foreground">cargando categorías…</span>}
              </h3>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Cargando productos…</p>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Sin productos que coincidan con los filtros</p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="h-11 sm:h-8">
                    Limpiar filtros
                  </Button>
                )}
                {products.length === 0 && !hasActiveFilters && <p className="text-xs text-muted-foreground">No hay productos cargados.</p>}
              </div>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-50 dark:bg-muted/40 border-b border-slate-200 dark:border-border">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-muted-foreground tracking-wider uppercase">Producto</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-muted-foreground tracking-wider uppercase">Precio</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-muted-foreground tracking-wider uppercase">Stock</th>
                      <th className="w-[72px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-border">
                    {filteredProducts.map((p) => {
                      const imgSrc = (p.imageUrl as string | null | undefined) ?? null;
                      const resolved = imgSrc ? (imgSrc.startsWith("/") ? `${API_URL}${imgSrc}` : imgSrc) : "/img-prod.webp";
                      const stock = p.stock;
                      const isOut = stock <= 0;
                      const isLow = stock > 0 && stock <= (p.minStock ?? 5);
                      const unitLabel = (p.isSoldByWeight || (p.unit ?? "").toLowerCase() === "kg") ? "kg" : "un.";
                      const cats = productCategories[p.id] ?? [];
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setSelectedProduct(p)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-[50px] w-[50px] rounded-lg bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border flex items-center justify-center shrink-0 overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={resolved}
                                  alt={p.name}
                                  className="h-full w-full object-contain"
                                  onError={(e) => ((e.target as HTMLImageElement).src = "/img-prod.webp")}
                                />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-slate-900 dark:text-foreground leading-tight line-clamp-2">{p.name}</span>
                                <span className="text-xs text-slate-500 dark:text-muted-foreground font-mono">{p.sku}{cats.length > 0 ? ` · ${cats.map((c) => c.name).join(", ")}` : ""}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold font-mono text-slate-900 dark:text-foreground tabular-nums">${Number(p.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isOut ? (
                              <span className="inline-flex items-center bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-2.5 py-1 rounded-full">Agotado · 0 {unitLabel}</span>
                            ) : isLow ? (
                              <span className="inline-flex items-center bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">{Number(stock).toLocaleString("es-AR", { maximumFractionDigits: 3 })} {unitLabel} · Bajo</span>
                            ) : (
                              <span className="inline-flex items-center text-sm font-medium text-slate-700 dark:text-foreground tabular-nums">{Number(stock).toLocaleString("es-AR", { maximumFractionDigits: 3 })} {unitLabel}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" aria-label={`Acciones de ${p.name}`} className="h-11 w-11 rounded-lg hover:bg-slate-100 dark:hover:bg-muted sm:h-8 sm:w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => setSelectedProduct(p)} className="min-h-11 sm:min-h-8">
                                  <Pencil className="h-4 w-4 mr-2" /> Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem className="min-h-11 text-red-600 focus:text-red-600 sm:min-h-8" onClick={() => handleDelete(p)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-border bg-slate-50/50 dark:bg-muted/20">
              <p className="text-xs text-muted-foreground">
                <span className="sm:hidden">Deslizá horizontalmente para ver acciones; tocá una fila para abrir el detalle.</span>
                <span className="hidden sm:inline">Click en una fila para ver detalle, historial y edición rápida.</span>
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Categorias Tab */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categorías
              </h2>
              <p className="text-sm text-muted-foreground">Gestioná las categorías de productos</p>
            </div>
            <Button onClick={openCreateFromTab} aria-label="Nueva categoría" className="h-11 w-full gap-1.5 rounded-xl bg-red-600 font-medium text-white shadow-sm hover:bg-red-700 sm:w-auto lg:h-9">
              <Plus className="h-4 w-4" />
              Nueva categoría
            </Button>
          </div>

          {catBannerSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">{catBannerSuccess}</div>
          )}
          {catBannerError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex justify-between items-center gap-2">
              <span>{catBannerError}</span>
              <button onClick={() => setCatBannerError(null)} className="min-h-11 min-w-11 shrink-0 px-2 text-xs underline sm:min-h-0 sm:min-w-0">
                Cerrar
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-border dark:bg-card">
            <div className="relative w-full min-w-0 max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o descripción..."
                value={catSearchTerm}
                onChange={(e) => setCatSearchTerm(e.target.value)}
                className="pl-9 h-11 bg-slate-50 dark:bg-muted/40 border-slate-200 dark:border-border rounded-xl focus:bg-white dark:focus:bg-card sm:h-10"
              />
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {catLoading ? "Cargando..." : `${filteredCategories.length} de ${categories.length}`}
            </span>
          </div>

          {catLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm rounded-xl p-4 animate-pulse">
                  <div className="h-5 bg-muted rounded w-1/2 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-7 bg-muted rounded w-16" />
                    <div className="h-7 bg-muted rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : catError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center justify-between gap-2">
              <span className="text-sm">{catError}</span>
              <Button variant="outline" size="sm" onClick={() => refreshCategoriesAndMap()} className="h-11 sm:h-8">
                Reintentar
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-card border rounded-xl p-8 text-center flex flex-col items-center gap-3">
              <Tag className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin categorías — creá la primera</p>
              <Button onClick={openCreateFromTab} size="sm" className="h-11 sm:h-8">
                <Plus className="h-4 w-4 mr-1" />
                Nueva categoría
              </Button>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="bg-card border rounded-xl p-8 text-center text-sm text-muted-foreground">
              No se encontraron categorías para &quot;{catSearchTerm}&quot;
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-800 dark:text-foreground truncate text-sm leading-tight">{cat.name}</h3>
                      <span className="bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground text-xs font-medium px-2 py-1 rounded-full shrink-0">
                        {cat.productCount} ítems
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${cat.name}`} onClick={() => openEditFromTab(cat)} className="h-11 w-11 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-muted dark:hover:text-slate-200 sm:h-7 sm:w-7">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${cat.name}`}
                        onClick={() => confirmDeleteCat(cat)}
                        className="h-11 w-11 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 sm:h-7 sm:w-7"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {cat.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-1 truncate" title={cat.description}>{cat.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Drawer lateral */}
      {selectedProduct && activeTab === "productos" && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedProduct(null)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label={`Detalle del producto ${selectedProduct.name}`} className="flex h-full w-full min-w-0 max-w-[480px] flex-col overflow-hidden border-l border-border bg-card shadow-xl">
            {/* Cabecera compacta: nombre, SKU, precio y stock */}
            <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-card p-4 sm:p-5">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold truncate text-foreground">{selectedProduct.name}</h2>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    SKU: {selectedProduct.sku} {selectedProduct.barcode ? `· EAN: ${selectedProduct.barcode}` : ""}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    <span className="font-mono tabular-nums font-bold text-[15px] text-foreground">
                      ${Number(selectedProduct.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                    {(() => {
                      const isWeightDrawer = selectedProduct.isSoldByWeight === true || (selectedProduct.unit ?? "").toLowerCase() === "kg";
                      const unitLabel = isWeightDrawer ? "kg" : "un.";
                      const stockStr = Number(selectedProduct.stock).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
                      const isLow = selectedProduct.stock > 0 && selectedProduct.stock <= (selectedProduct.minStock ?? 5);
                      const isOut = selectedProduct.stock <= 0;
                      return (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border tabular-nums ${
                            isOut
                              ? "bg-red-50 text-red-700 border-red-200"
                              : isLow
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-green-50 text-green-700 border-green-200"
                          }`}
                        >
                          {isOut ? `Sin stock · 0 ${unitLabel}` : isLow ? `${stockStr} ${unitLabel} · Bajo` : `${stockStr} ${unitLabel}`}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedProduct(null)} aria-label="Cerrar" autoFocus className="h-11 w-11 shrink-0 rounded-lg sm:h-9 sm:w-9">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {/* Tabs pill */}
              <div className="mt-4 bg-muted p-1 rounded-xl flex gap-1">
                <button
                  onClick={() => setDrawerTab("datos")}
                  className={`min-h-11 flex-1 py-1.5 px-3 text-xs font-medium rounded-xl transition-colors sm:min-h-0 ${drawerTab === "datos" ? "bg-white dark:bg-card shadow-sm border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Datos y Precios
                </button>
                <button
                  onClick={() => setDrawerTab("historial")}
                  className={`min-h-11 flex-1 py-1.5 px-3 text-xs font-medium rounded-xl transition-colors sm:min-h-0 ${drawerTab === "historial" ? "bg-white dark:bg-card shadow-sm border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Historial y Stock
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 pb-2 flex flex-col gap-6 sm:p-6">
              {drawerTab === "datos" ? (
                <>
                  {/* Datos y Precios - ordered form */}
                  <section className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Nombre del producto</label>
                        <Input value={quickName} onChange={(e) => setQuickName(e.target.value)} maxLength={50} placeholder="Nombre del producto" className="h-11 bg-card border-input rounded-xl text-sm sm:h-9" />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Código interno (SKU)</label>
                        <Input value={selectedProduct.sku} disabled className="h-11 bg-muted/40 border-input rounded-xl text-sm font-mono tabular-nums opacity-70 sm:h-9" />
                        <p className="text-[11px] text-muted-foreground">No editable tras creación</p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Código de barras (EAN)</label>
                        <Input value={selectedProduct.barcode ?? ""} disabled placeholder="Sin código de barras" className="h-11 bg-muted/40 border-input rounded-xl text-sm font-mono tabular-nums opacity-70 sm:h-9" />
                        <p className="text-[11px] text-muted-foreground">No editable tras creación</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Precio de venta</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                        <Input type="number" step="0.01" min="0" value={quickPrice} onChange={(e) => setQuickPrice(e.target.value)} placeholder="0.00" className="pl-7 h-11 bg-card border-input rounded-xl font-bold font-mono tabular-nums text-[15px] sm:h-10" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Modo de venta</label>
                      <Select value={quickUnit || "un"} onValueChange={(v) => setQuickUnit(v as "un" | "kg")}>
                        <SelectTrigger className="h-11 bg-card border-input rounded-xl text-sm sm:h-9">
                          <SelectValue placeholder="Modo de venta" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="un">Unidad</SelectItem>
                          <SelectItem value="kg">Granel (kg)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{quickUnit === "kg" ? "Se vende fraccionado, stock en kg (ej: 0,4 kg)" : "Se vende por unidades enteras"}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-foreground flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5" /> Categorías asignadas
                      </label>
                      {selectedCats.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin categorías asignadas.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCats.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium">
                              {c.name}
                              <button onClick={() => handleRemove(selectedProduct, c.id)} className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full hover:text-red-600 sm:h-5 sm:w-5" aria-label={`Quitar ${c.name}`}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Select value={assignCatId} onValueChange={setAssignCatId}>
                          <SelectTrigger className="flex-1 h-11 border-input bg-card rounded-xl text-sm sm:h-9">
                            <SelectValue placeholder="Asignar categoría…" />
                          </SelectTrigger>
                          <SelectContent>
                            {unassignedCats.length === 0 ? (
                              <SelectItem value="__none" disabled>
                                Sin categorías disponibles
                              </SelectItem>
                            ) : (
                              unassignedCats.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={handleDrawerAssign} disabled={!assignCatId || assignCatId === "__none"} className="h-11 shrink-0 rounded-xl sm:h-9">
                          Asignar
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => { setEditingCategory(null); setCatModalOrigin("drawer"); setShowCatModal(true); }} className="h-11 w-fit gap-1.5 rounded-xl text-xs sm:h-8">
                        <Plus className="h-3.5 w-3.5" /> Nueva categoría
                      </Button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Stock mínimo de alerta</label>
                        <Input type="number" min="0" max="99999" step={quickUnit === "kg" ? "0.001" : "1"} value={quickMinStock} onChange={(e) => setQuickMinStock(e.target.value)} placeholder={quickUnit === "kg" ? "Ej: 2.5" : "Ej: 5"} className="h-11 bg-card border-input rounded-xl text-sm tabular-nums sm:h-9" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Imagen</label>
                      <div className="flex gap-3 items-start">
                        <div className="h-20 w-20 rounded-xl bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border flex items-center justify-center overflow-hidden shrink-0">
                          {quickPreviewUrl ? (
                            <img src={quickPreviewUrl} alt="preview" className="h-full w-full object-cover" />
                          ) : quickImageUrl.trim() ? (
                            <img src={quickImageUrl.trim().startsWith("/") ? `${API_URL}${quickImageUrl.trim()}` : quickImageUrl.trim()} alt="preview url" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                          ) : selectedProduct.imageUrl ? (
                            <img src={selectedProduct.imageUrl.startsWith("/") ? `${API_URL}${selectedProduct.imageUrl}` : selectedProduct.imageUrl} alt="actual" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                          ) : (
                            <Package className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                          <label className="inline-flex items-center justify-center gap-2 h-11 px-3 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-sm font-medium cursor-pointer sm:h-9">
                            Subir archivo
                            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setQuickError(null); if (f) { if (f.size > 5*1024*1024) { setQuickError("Archivo muy grande (máximo 5MB)"); (e.target as HTMLInputElement).value=""; return; } if (f.type && !f.type.startsWith("image/")) { setQuickError("Formato no soportado (solo imágenes)"); (e.target as HTMLInputElement).value=""; return; } } setQuickSelectedFile(f); if (quickPreviewUrl) URL.revokeObjectURL(quickPreviewUrl); if (f) setQuickPreviewUrl(URL.createObjectURL(f)); else setQuickPreviewUrl(null); }} className="hidden" />
                          </label>
                          <div className="relative">
                          <Input type="url" value={quickImageUrl} onChange={(e) => setQuickImageUrl(e.target.value)} placeholder="o pegar URL https://..." className="h-11 bg-card border-input rounded-xl pr-8 text-sm sm:h-9" />
                          </div>
                          {(quickSelectedFile || quickImageUrl.trim()) && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground truncate flex-1">{quickSelectedFile?.name || quickImageUrl.trim()}</span>
                              <button type="button" onClick={() => { setQuickSelectedFile(null); setQuickImageUrl(""); if (quickPreviewUrl) { URL.revokeObjectURL(quickPreviewUrl); setQuickPreviewUrl(null); } }} className="min-h-11 min-w-11 shrink-0 px-2 text-xs text-red-600 hover:underline sm:min-h-0 sm:min-w-0">
                                Quitar
                              </button>
                            </div>
                          )}
                          {quickSelectedFile && quickImageUrl.trim() && <p className="text-xs text-amber-600 leading-tight">Se priorizará el archivo sobre la URL.</p>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Descripción</label>
                      <Input value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)} maxLength={500} placeholder="Descripción (opcional)" className="h-11 bg-card border-input rounded-xl text-sm sm:h-9" />
                    </div>

                    {quickError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-xl p-2">{quickError}</p>}
                    {quickSuccess && <p className="text-sm text-green-700 border border-green-200 bg-green-50 rounded-xl p-2">{quickSuccess}</p>}

                    <div className="pt-2 border-t border-border mt-1 pb-4">
                      {!drawerDeleteConfirm ? (
                        <button onClick={() => setDrawerDeleteConfirm(true)} className="min-h-11 w-full rounded-lg py-2 text-center text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
                          Eliminar este producto
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-3">
                          <p className="text-xs text-red-700 dark:text-red-300 font-medium text-center">¿Eliminar {selectedProduct.name}? Esta acción no se puede deshacer.</p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setDrawerDeleteConfirm(false)} className="h-11 flex-1 rounded-lg text-xs sm:h-8">
                              Cancelar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                const prod = selectedProduct;
                                setDrawerDeleteConfirm(false);
                                if (!prod) return;
                                try {
                                  await deleteProduct(prod.id);
                                  if (selectedProduct?.id === prod.id) setSelectedProduct(null);
                                  await fetchProducts();
                                  await refreshCategoriesAndMap();
                                } catch (e) {
                                  const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al eliminar";
                                  setQuickError(msg);
                                }
                              }}
                              className="h-11 flex-1 rounded-lg text-xs sm:h-8"
                            >
                              Sí, eliminar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  {/* Historial y Stock */}
                  <section className="border rounded-xl p-4 bg-muted/20 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold">Ajuste rápido de stock</h3>
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-muted-foreground">Cantidad</label>
                          <Input
                            type="number"
                            min="0"
                            step={(selectedProduct.isSoldByWeight === true || (selectedProduct.unit ?? "").toLowerCase() === "kg") ? "0.001" : "1"}
                            value={drawerDelta}
                            onChange={(e) => setDrawerDelta(e.target.value)}
                            placeholder={(selectedProduct.isSoldByWeight === true || (selectedProduct.unit ?? "").toLowerCase() === "kg") ? "Ej: 1.5" : "Ej: 5"}
                            className="h-11 bg-card border-input rounded-xl tabular-nums sm:h-9"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-muted-foreground">Motivo</label>
                          <Input value={drawerReason} onChange={(e) => setDrawerReason(e.target.value)} maxLength={250} placeholder="Ej: Recepción" className="h-11 bg-card border-input rounded-xl text-sm sm:h-9" />
                        </div>
                      </div>
                      {drawerAdjustError && <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg p-2">{drawerAdjustError}</p>}
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => handleDrawerStockAdjust(1)} disabled={drawerAdjustLoading} className="h-11 rounded-xl bg-green-600 text-sm font-medium text-white hover:bg-green-700 sm:h-9">
                          + Sumar
                        </Button>
                        <Button onClick={() => handleDrawerStockAdjust(-1)} disabled={drawerAdjustLoading} className="h-11 rounded-xl bg-red-600 text-sm font-medium text-white hover:bg-red-700 sm:h-9">
                          − Restar
                        </Button>
                      </div>
                    </div>
                  </section>

                  <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <History className="h-4 w-4" /> Kardex cronológico
                      </h3>
                      <span className="text-xs text-muted-foreground tabular-nums">{kardexMerged.length} mov.</span>
                    </div>
                    <div className="bg-muted p-1 rounded-lg flex flex-wrap gap-1 w-fit max-w-full">
                      <button onClick={() => setDrawerKardexFilter("todos")} className={`min-h-11 px-3 py-1 text-xs font-medium rounded-md transition-colors sm:min-h-0 ${drawerKardexFilter === "todos" ? "bg-white dark:bg-card shadow-sm border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        Todos
                      </button>
                      <button onClick={() => setDrawerKardexFilter("stock")} className={`min-h-11 px-3 py-1 text-xs font-medium rounded-md transition-colors sm:min-h-0 ${drawerKardexFilter === "stock" ? "bg-white dark:bg-card shadow-sm border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        Solo Stock
                      </button>
                      <button onClick={() => setDrawerKardexFilter("precios")} className={`min-h-11 px-3 py-1 text-xs font-medium rounded-md transition-colors sm:min-h-0 ${drawerKardexFilter === "precios" ? "bg-white dark:bg-card shadow-sm border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        Solo Precios
                      </button>
                    </div>

                    {auditsLoading || priceHistoryLoading ? (
                      <div className="py-4 flex flex-col gap-2">
                        <div className="h-12 bg-muted rounded-xl animate-pulse" />
                        <div className="h-12 bg-muted rounded-xl animate-pulse" />
                        <div className="h-12 bg-muted rounded-xl animate-pulse" />
                      </div>
                    ) : auditsError && priceHistoryError ? (
                      <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-xl p-3">{auditsError}</p>
                    ) : kardexMerged.length === 0 ? (
                      <p className="text-sm text-muted-foreground border border-dashed rounded-xl p-6 text-center">Sin movimientos aún</p>
                    ) : (
                      <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                        {kardexMerged.map((entry) => {
                          const isStock = entry.type === "stock";
                          const dateStr = new Date(entry.date).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
                          if (isStock) {
                            const s = entry as unknown as { delta: number; resultingStock: number; reason: string };
                            const isPos = s.delta > 0;
                            const isNeg = s.delta < 0;
                            const unitLabel = (selectedProduct.isSoldByWeight === true || (selectedProduct.unit ?? "").toLowerCase() === "kg") ? "kg" : "un.";
                            return (
                              <div key={entry.id} className="flex justify-between items-center p-3 gap-3 hover:bg-muted/20 transition-colors">
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-xs text-muted-foreground tabular-nums">{dateStr}</span>
                                  <span className="text-sm truncate max-w-[180px]" title={formatReason(s.reason)}>
                                    {formatReason(s.reason)}
                                  </span>
                                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 w-fit mt-0.5">Stock</span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                  <span className={`font-semibold tabular-nums text-sm ${isPos ? "text-green-600" : isNeg ? "text-red-600" : "text-foreground"}`}>
                                    {isPos ? `+${Number(s.delta).toLocaleString("es-AR", { maximumFractionDigits: 3 })}` : Number(s.delta).toLocaleString("es-AR", { maximumFractionDigits: 3 })}
                                  </span>
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    → {Number(s.resultingStock).toLocaleString("es-AR", { maximumFractionDigits: 3 })} {unitLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          } else {
                            const p = entry as unknown as { oldPrice: number; newPrice: number; changePercent: number; reason: string | null };
                            const isUp = p.newPrice > p.oldPrice;
                            const isDown = p.newPrice < p.oldPrice;
                            const diff = p.newPrice - p.oldPrice;
                            return (
                              <div key={entry.id} className="flex justify-between items-center p-3 gap-3 hover:bg-muted/20 transition-colors">
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-xs text-muted-foreground tabular-nums">{dateStr}</span>
                                  <span className="text-sm truncate max-w-[180px]" title={formatReason(p.reason)}>
                                    {formatReason(p.reason)}
                                  </span>
                                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 w-fit mt-0.5">Precio</span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                  <span className="font-mono tabular-nums text-sm text-foreground">
                                    ${Number(p.oldPrice).toLocaleString("es-AR", { minimumFractionDigits: 2 })} → ${Number(p.newPrice).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                  </span>
                                  <span className={`text-xs tabular-nums inline-flex items-center gap-1 ${isUp ? "text-green-600" : isDown ? "text-red-600" : "text-muted-foreground"}`}>
                                    {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
                                    <span>
                                      ({p.changePercent === 0 ? "0%" : `${p.changePercent > 0 ? "+" : ""}${p.changePercent.toFixed(1)}%`}
                                      {diff !== 0 ? ` · ${diff > 0 ? "+" : "-"} $${Math.abs(diff).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : ""})
                                    </span>
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
            {drawerTab === "datos" && (
              <div className="sticky bottom-0 bg-white/95 dark:bg-card/95 backdrop-blur border-t border-slate-200 dark:border-border p-4 shrink-0">
                <Button onClick={handleQuickSave} disabled={quickLoading} className="min-h-11 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-medium sm:min-h-0">
                  {quickLoading ? "Guardando…" : "Guardar Cambios"}
                </Button>
              </div>
            )}
          </div>
          {drawerConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDrawerConfirmOpen(false)}>
              <div role="dialog" aria-modal="true" aria-label="Confirmar ajuste de stock" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col gap-4 overflow-y-auto overscroll-y-contain rounded-xl border bg-white p-5 shadow-lg dark:bg-card" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-semibold">Confirmar ajuste</h3>
                <p className="text-sm text-muted-foreground">
                  ¿Confirmás registrar {drawerConfirmSign > 0 ? `+${drawerConfirmAmount}` : `-${drawerConfirmAmount}`} unidades en el stock con motivo &apos;{drawerReason.trim() || "Ajuste manual"}&apos;?
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button autoFocus variant="outline" onClick={() => setDrawerConfirmOpen(false)} disabled={drawerAdjustLoading} className="h-11 w-full rounded-xl sm:h-9 sm:w-auto">
                    Cancelar
                  </Button>
                  <Button
                    onClick={confirmDrawerStockAdjust}
                    disabled={drawerAdjustLoading}
                    className={`h-11 w-full rounded-xl text-white sm:h-9 sm:w-auto ${drawerConfirmSign > 0 ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                  >
                    {drawerAdjustLoading ? "Guardando…" : "Confirmar"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteConfirmId && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-label={`Eliminar categoría ${deleteTarget.name}`} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-4 overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-card p-4 shadow-lg sm:p-6">
            <h3 className="text-lg font-semibold">¿Eliminar &quot;{deleteTarget.name}&quot;?</h3>
            <p className="text-sm text-muted-foreground">Se desactivará la categoría. Esta acción no elimina los productos asociados.</p>
            {deleteTarget.productCount > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                Esta categoría tiene {deleteTarget.productCount} producto{deleteTarget.productCount === 1 ? "" : "s"} activo
                {deleteTarget.productCount === 1 ? "" : "s"}. Si intentás eliminarla, el servidor responderá con error 409.
              </p>
            )}
            {deleteError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-2 text-sm">{deleteError}</div>}
            <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button autoFocus variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleteLoading} className="h-11 w-full sm:h-9 sm:w-auto">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteCategory} disabled={deleteLoading} className="h-11 w-full sm:h-9 sm:w-auto">
                {deleteLoading ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <CategoryFormModal open={showCatModal} onClose={closeCatModal} onSuccess={handleCategoryCreated} editingCategory={editingCategory} categories={categories} />

      <NewProductModal
        open={showNewProduct}
        onClose={() => setShowNewProduct(false)}
        onSuccess={async () => {
          await fetchProducts();
          await refreshCategoriesAndMap();
        }}
        categories={categories}
        onCategoriesRefresh={refreshCategoriesAndMap}
      />

      {/* 5. Modal Ajuste Masivo - con redondeo comercial */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-label="Ajuste masivo de precios" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col gap-3 overflow-y-auto overscroll-y-contain rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-border dark:bg-card sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-slate-700 dark:text-foreground" /> Ajuste masivo de precios
              </h3>
              <button autoFocus onClick={() => setShowBulk(false)} aria-label="Cerrar ajuste masivo" className="h-11 w-11 rounded-md p-1 hover:bg-muted sm:h-8 sm:w-8">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Categoría objetivo</label>
                <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                  <SelectTrigger className="w-full border-slate-200 dark:border-border bg-white dark:bg-card rounded-xl h-11 sm:h-10">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo el catálogo</SelectItem>
                    {categories.filter((c) => c.isActive).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Redondeo comercial</label>
                <Select value={bulkRounding} onValueChange={(v) => setBulkRounding(v as typeof bulkRounding)}>
                  <SelectTrigger className="w-full border-slate-200 dark:border-border bg-white dark:bg-card rounded-xl h-11 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin redondeo</SelectItem>
                    <SelectItem value="10">Redondear a $10</SelectItem>
                    <SelectItem value="50">Redondear a $50</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Evita precios engorrosos en mostrador (ej: $1.237 → $1.240 / $1.250)</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" className="bg-slate-100 dark:bg-muted p-1 rounded-xl flex gap-1 shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={bulkMode === "percent"}
                  onClick={() => setBulkMode("percent")}
                  className={`min-h-11 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors sm:min-h-0 ${bulkMode === "percent" ? "bg-white dark:bg-card shadow-sm border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Porcentaje (%)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={bulkMode === "fixed"}
                  onClick={() => setBulkMode("fixed")}
                  className={`min-h-11 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors sm:min-h-0 ${bulkMode === "fixed" ? "bg-white dark:bg-card shadow-sm border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Monto fijo ($)
                </button>
              </div>

              <div className="relative flex-1 min-w-[140px]">
                {bulkMode === "fixed" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono pointer-events-none">$</span>
                )}
                <Input
                  type="number"
                  step="0.01"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={bulkMode === "percent" ? "Ej: 10" : "Ej: 500"}
                  aria-label={bulkMode === "percent" ? "Porcentaje de aumento" : "Monto fijo a sumar"}
                  className={`rounded-xl h-11 bg-slate-50 dark:bg-muted/40 focus:bg-white border-slate-200 dark:border-border sm:h-10 ${bulkMode === "percent" ? (bulkValue !== "" && bulkValue !== "0" ? "pr-14" : "pr-8") : bulkValue !== "" && bulkValue !== "0" ? "pl-8 pr-10" : "pl-8"}`}
                />
                {bulkMode === "percent" && (
                  <span className={`absolute top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono pointer-events-none ${bulkValue !== "" && bulkValue !== "0" ? "right-8" : "right-3"}`}>%</span>
                )}
                {bulkValue !== "" && bulkValue !== "0" && (
                  <button
                    type="button"
                    onClick={() => setBulkValue("")}
                    className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-muted-foreground dark:hover:bg-muted sm:h-6 sm:w-6"
                    aria-label="Limpiar valor"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {bulkMode === "percent"
                  ? [5, 10, 15, 20, 25].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setBulkValue(String((parseFloat(bulkValue) || 0) + v))}
                        className="min-h-11 min-w-[44px] rounded-full border bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:bg-card dark:hover:bg-muted sm:min-h-0 sm:min-w-0"
                      >
                        +{v}%
                      </button>
                    ))
                  : [100, 500, 1000, 2000, 5000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setBulkValue(String((parseFloat(bulkValue) || 0) + v))}
                        className="min-h-11 min-w-[44px] rounded-full border bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:bg-card dark:hover:bg-muted sm:min-h-0 sm:min-w-0"
                      >
                        +{v >= 1000 ? `${v / 1000}K` : v}
                      </button>
                    ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} maxLength={500} placeholder="Ej: Inflación agosto 2026 — si queda vacío se autocompleta" className="rounded-xl h-11 sm:h-9" />
              <span className="text-xs text-muted-foreground text-right">{bulkReason.trim().length}/500</span>
            </div>

            <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card">
              <div className="max-h-[340px] overflow-x-auto overflow-y-auto overscroll-x-contain pr-3 [scrollbar-width:thin] [scrollbar-gutter:stable]" style={{ scrollbarGutter: "stable" as const }}>
              <table className="w-full min-w-[640px] table-auto text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-muted/50 z-10 border-b border-slate-200 dark:border-border">
                    <tr>
                      <th className="p-2 text-left w-10">
                        <label className="inline-flex min-h-11 min-w-11 items-center justify-center sm:min-h-0 sm:min-w-0">
                          <input aria-label="Seleccionar todos los productos" type="checkbox" checked={bulkAllChecked} onChange={(e) => { const checked = e.target.checked; const next: Record<string, boolean> = {}; bulkPreview.forEach((b) => (next[b.id] = checked)); setBulkSelected(next); }} />
                        </label>
                      </th>
                      <th className="p-2 text-left text-xs font-semibold text-slate-500 tracking-wider uppercase">SKU</th>
                      <th className="p-2 text-left text-xs font-semibold text-slate-500 tracking-wider uppercase">Producto</th>
                      <th className="p-2 text-right text-xs font-semibold text-slate-500 tracking-wider uppercase">Anterior</th>
                      <th className="p-2 text-right text-xs font-semibold text-slate-500 tracking-wider uppercase">Nuevo</th>
                      <th className="p-2 text-center text-xs font-semibold text-slate-500 tracking-wider uppercase">Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          Sin productos
                        </td>
                      </tr>
                    ) : (
                      bulkPreview.map((b) => {
                        const checked = bulkSelected[b.id] !== false;
                        const isIncrease = b.newPrice > b.oldPrice;
                        const isDecrease = b.newPrice < b.oldPrice;
                        return (
                          <tr key={b.id} className={`border-t border-slate-100 dark:border-border ${!checked ? "opacity-50" : ""}`}>
                            <td className="p-2">
                              <label className="inline-flex min-h-11 min-w-11 items-center justify-center sm:min-h-0 sm:min-w-0">
                                <input aria-label={`Seleccionar ${b.name}`} type="checkbox" checked={checked} onChange={(e) => setBulkSelected((prev) => ({ ...prev, [b.id]: e.target.checked }))} />
                              </label>
                            </td>
                            <td className="p-2 font-mono text-xs">{b.sku}</td>
                            <td className="p-2 truncate max-w-[180px]" title={b.name}>
                              {b.name}
                            </td>
                            <td className="p-2 text-right tabular-nums">${b.oldPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-right font-bold font-mono tabular-nums">${b.newPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-center">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border ${isIncrease ? "bg-green-50 text-green-700 border-green-200" : isDecrease ? "bg-red-50 text-red-700 border-red-200" : "bg-muted text-muted-foreground"}`}>
                                {b.changePercent === 0 ? "0%" : `${b.changePercent > 0 ? "+" : ""}${b.changePercent.toFixed(2)}%`}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm"><span className="font-semibold">Afectados:</span> {bulkPreviewFiltered.length} de {bulkPreview.length}</div>
              {bulkError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-2 text-sm">{bulkError}</div>}
              {bulkSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-md p-2 text-sm">{bulkSuccess}</div>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setShowBulk(false)} disabled={bulkLoading} className="h-11 w-full rounded-xl sm:h-9 sm:w-auto">
                  Cerrar
                </Button>
                <Button onClick={handleBulkConfirm} disabled={bulkLoading || bulkPreviewFiltered.length === 0 || !bulkHasAdjustment || bulkReason.trim().length > 500} className="h-11 w-full rounded-xl bg-red-600 text-white hover:bg-red-700 sm:h-9 sm:w-auto">
                  {bulkLoading ? "Aplicando..." : `Confirmar ajuste (${bulkPreviewFiltered.length})`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function InventarioPage() {
  return (
    <Suspense fallback={<main className="w-full min-w-full max-w-none p-4 text-sm text-muted-foreground">Cargando Inventario…</main>}>
      <InventarioPageContent />
    </Suspense>
  );
}
