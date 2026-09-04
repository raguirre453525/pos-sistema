"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StatCard from "@/components/Dashboard/StatCard";
import DataTable from "@/components/Reusables/DataTable";
import { createProductColumns } from "@/components/Inventario/DataTable/productColumns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Package, PackagePlus, Tag, Pencil, Search, X, History, AlertTriangle, Plus, Trash2, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import CategoryFormModal from "@/components/Categorias/CategoryFormModal";
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

function InventarioPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const [adjustTarget, setAdjustTarget] = useState<ProductDto | null>(null);
  const [delta, setDelta] = useState<string>("1");
  const [reason, setReason] = useState<string>("Ajuste manual");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

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

  // B2 states
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc">("name_asc");

  // Drawer / selected product
  const [selectedProduct, setSelectedProduct] = useState<ProductDto | null>(null);
  const [audits, setAudits] = useState<StockAuditDto[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [auditsError, setAuditsError] = useState<string | null>(null);

  // Price history tab
  const [priceHistoryTab, setPriceHistoryTab] = useState<"stock" | "precios">("stock");
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistoryDto[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);

  // quick edit inside drawer
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

  // FIX: revoca objectURL al desmontar para evitar leak; hardening evita crash por URLs huérfanas
  useEffect(() => {
    return () => {
      if (quickPreviewUrl) URL.revokeObjectURL(quickPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickPreviewUrl]);

  // Bulk price adjustment state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("all");
  const [bulkPercentage, setBulkPercentage] = useState<string>("");
  const [bulkFixed, setBulkFixed] = useState<string>("");
  const [bulkReason, setBulkReason] = useState<string>("");
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
    const pct = parseFloat(bulkPercentage);
    const hasPct = !isNaN(pct) && pct !== 0;
    const fx = parseFloat(bulkFixed);
    const hasFx = !isNaN(fx) && fx !== 0;
    return bulkFilteredByCategory.map((p) => {
      const oldPrice = p.price;
      let newPrice = oldPrice;
      if (hasPct || hasFx) {
        const pctVal = hasPct ? pct : 0;
        const fxVal = hasFx ? fx : 0;
        newPrice = round2Away(oldPrice * (1 + pctVal / 100) + fxVal);
        if (newPrice < 0) newPrice = 0;
      }
      const changePercent = oldPrice === 0 ? 0 : ((newPrice - oldPrice) / oldPrice) * 100;
      return { id: p.id, sku: p.sku, name: p.name, oldPrice, newPrice, changePercent };
    });
  }, [bulkFilteredByCategory, bulkPercentage, bulkFixed]);

  const bulkPreviewFiltered = useMemo(() => {
    // only selected
    return bulkPreview.filter((b) => bulkSelected[b.id] !== false);
  }, [bulkPreview, bulkSelected]);

  const bulkAllChecked = bulkPreview.length > 0 && bulkPreview.every((b) => bulkSelected[b.id] !== false);
  const bulkHasAdjustment = (() => {
    const pct = parseFloat(bulkPercentage);
    const fx = parseFloat(bulkFixed);
    return (!isNaN(pct) && pct !== 0) || (!isNaN(fx) && fx !== 0);
  })();

  const openBulk = () => {
    // init selected to all true for current category
    const init: Record<string, boolean> = {};
    const filtered = bulkCategoryId === "all" ? products : products.filter((p) => (productCategories[p.id] ?? []).some((c) => c.id === bulkCategoryId));
    // but we will recompute in effect; just open
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
      // when category changes, reset to all true, but keep existing selections if same ids
      const next: Record<string, boolean> = {};
      filtered.forEach((p) => {
        next[p.id] = prev[p.id] ?? true;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkCategoryId, showBulk, bulkFilteredByCategory.length]);

  const handleBulkConfirm = async () => {
    const pct = parseFloat(bulkPercentage);
    const fx = parseFloat(bulkFixed);
    const percentage = !isNaN(pct) && pct !== 0 ? pct : null;
    const fixedAmount = !isNaN(fx) && fx !== 0 ? fx : null;
    const reasonTrim = bulkReason.trim();
    if (reasonTrim.length < 3 || reasonTrim.length > 500) {
      setBulkError("Motivo requerido (3..500 caracteres)");
      return;
    }
    if (percentage === null && fixedAmount === null) {
      setBulkError("Al menos uno de % o monto fijo debe ser distinto de 0");
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
      const result = await bulkAdjustPrices({
        categoryId: null,
        productIds: selectedIds,
        percentage,
        fixedAmount,
        reason: reasonTrim,
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

  // auto-dismiss banner success
  useEffect(() => {
    if (!catBannerSuccess) return;
    const t = setTimeout(() => setCatBannerSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [catBannerSuccess]);

  // fetch audits & price history when drawer opens
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
    // init quick edit fields
    setPriceHistoryTab("stock");
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
      result = result.filter((p) => {
        const isLow = p.minStock != null ? p.stock <= p.minStock : p.stock <= 5;
        return isLow && p.stock > 0;
      });
    } else if (stockFilter === "out") {
      result = result.filter((p) => p.stock <= 0);
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

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    const deltaNum = parseFloat(delta.replace(",", "."));
    if (isNaN(deltaNum) || deltaNum === 0) {
      setAdjustError("Delta debe ser distinto de 0");
      return;
    }
    if (Math.round(deltaNum * 1000) / 1000 !== deltaNum) {
      setAdjustError("Delta no puede tener más de 3 decimales");
      return;
    }
    const isWeightAdjust = adjustTarget.isSoldByWeight === true || (adjustTarget.unit ?? "").toLowerCase() === "kg";
    if (!isWeightAdjust && !Number.isInteger(deltaNum)) {
      setAdjustError("Para productos por unidad el delta debe ser entero");
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
      // refresh selectedProduct stock if drawer open on same product
      if (selectedProduct && selectedProduct.id === adjustTarget.id) {
        try {
          const updated = await getProducts();
          setProducts(updated);
          const found = updated.find((p) => p.id === adjustTarget.id);
          if (found) setSelectedProduct(found);
        } catch {}
      }
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
      // For image: if file selected, prioritize file upload after update. Send imageUrl only if no file.
      const imageUrlToSend = quickSelectedFile ? undefined : (quickImageUrl.trim() || null);
      // Build DTO: include unit/minStock/imageUrl only if changed? Backend preserves if null so we send accordingly
      const dto: any = { name, price: priceNum, description: desc };
      if (resolvedUnit !== (selectedProduct.unit ?? "")) dto.unit = resolvedUnit || null;
      else dto.unit = selectedProduct.unit ?? null;
      if (minStockNum !== undefined) dto.minStock = minStockNum;
      if (imageUrlToSend !== undefined) dto.imageUrl = imageUrlToSend;
      else dto.imageUrl = selectedProduct.imageUrl ?? null;
      // If file selected, we still send current imageUrl preserved, upload will override
      if (quickSelectedFile) dto.imageUrl = selectedProduct.imageUrl ?? null;

      await updateProduct(selectedProduct.id, dto);
      if (quickSelectedFile) {
        // FIX: validación cliente previa evita crash y no hace fetch si inválido; envuelto en try/catch para no cerrar la app
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
      // ensure categories updated; if origin tab show banner
      if (origin === "tab") {
        setCatBannerSuccess(`Categoría "${cat.name}" ${isEdit ? "actualizada" : "creada"}`);
        setCatBannerError(null);
      }
      // keep cats in sync (refresh already does)
      void cats;
    }
  };

  const closeCatModal = () => {
    setShowCatModal(false);
    setEditingCategory(null);
  };

  const openCreateFromFilter = () => {
    setEditingCategory(null);
    setCatModalOrigin("general");
    setShowCatModal(true);
  };

  const openCreateFromDrawer = () => {
    setEditingCategory(null);
    setCatModalOrigin("drawer");
    setShowCatModal(true);
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

  const columns = useMemo(
    () =>
      createProductColumns({
        onAdjust: (p) => {
          setAdjustTarget(p);
          setAdjustError(null);
        },
        onDelete: handleDelete,
        categoryMap: productCategories,
        categories,
        onAssign: handleAssign,
        onRemove: handleRemove,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productCategories, categories]
  );

  const selectedCats = selectedProduct ? productCategories[selectedProduct.id] ?? [] : [];
  const unassignedCats = activeCategories.filter((c) => !selectedCats.some((sc) => sc.id === c.id));

  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-semibold">INVENTARIO</h1>
        <p className="text-sm text-muted-foreground">Gestioná productos y categorías</p>
      </div>

      {/* Tabs header */}
      <div className="flex gap-2 border-b border-border pb-2 items-center">
        <Button variant={activeTab === "productos" ? "default" : "ghost"} onClick={() => handleTabChange("productos")} className="gap-2">
          <Package className="h-4 w-4" />
          Productos
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${activeTab === "productos" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border"}`}>
            {products.length}
          </span>
        </Button>
        <Button variant={activeTab === "categorias" ? "default" : "ghost"} onClick={() => handleTabChange("categorias")} className="gap-2">
          <Tag className="h-4 w-4" />
          Categorías
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${activeTab === "categorias" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border"}`}>
            {categories.length}
          </span>
        </Button>
        <div className="ml-auto">
          <Button variant="outline" onClick={openBulk} className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Ajuste masivo
          </Button>
        </div>
      </div>

      {activeTab === "productos" ? (
        <>
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
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    PRODUCTOS{" "}
                    <span className="text-sm font-normal text-muted-foreground">({filteredProducts.length}/{products.length})</span>
                    {productCatLoading && <span className="text-xs ml-2 text-muted-foreground">cargando categorías…</span>}
                  </h3>
                </div>

                {/* Filter bar B2 */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre o SKU..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 border-input bg-card"
                    />
                  </div>

                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="w-[180px] border-input bg-card">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
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
                    <SelectTrigger className="w-[200px] border-input bg-card">
                      <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="low">Stock crítico (≤5)</SelectItem>
                      <SelectItem value="out">Sin stock (0)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="w-[200px] border-input bg-card">
                      <SelectValue placeholder="Nombre A-Z" />
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
                    <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                      <X className="h-3.5 w-3.5" /> Limpiar filtros
                    </Button>
                  )}
                </div>
              </div>

              {catActionError && <p className="text-sm text-amber-700 border border-amber-200 bg-amber-50 rounded p-2 mb-3">{catActionError}</p>}

              {loading ? (
                <p className="text-sm text-muted-foreground py-10 text-center">Cargando productos…</p>
              ) : filteredProducts.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Sin productos que coincidan con los filtros</p>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  )}
                  {products.length === 0 && !hasActiveFilters && <p className="text-xs text-muted-foreground">No hay productos cargados.</p>}
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={filteredProducts}
                  label="Producto"
                  placeholder="Buscar por SKU, nombre…"
                  hideSearch
                  hidePagination
                  onRowClick={(p) => setSelectedProduct(p as ProductDto)}
                />
              )}
              <p className="text-xs text-muted-foreground mt-2">Click en una fila para ver detalle, historial y edición rápida.</p>
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
            <Button onClick={openCreateFromTab} className="gap-1.5">
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
              <button onClick={() => setCatBannerError(null)} className="text-xs underline shrink-0">
                Cerrar
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-card border rounded-2xl p-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o descripción..."
                value={catSearchTerm}
                onChange={(e) => setCatSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {catLoading ? "Cargando..." : `${filteredCategories.length} de ${categories.length}`}
            </span>
          </div>

          {catLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-card border rounded-2xl p-4 animate-pulse">
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
              <Button variant="outline" size="sm" onClick={() => void refreshCategoriesAndMap()}>
                Reintentar
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-card border rounded-2xl p-8 text-center flex flex-col items-center gap-3">
              <Tag className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin categorías — creá la primera</p>
              <Button onClick={openCreateFromTab} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nueva categoría
              </Button>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="bg-card border rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No se encontraron categorías para &quot;{catSearchTerm}&quot;
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-card border rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base leading-tight truncate pr-2">{cat.name}</h3>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                        cat.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {cat.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  {cat.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">{cat.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic min-h-[2.5rem]">Sin descripción</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground bg-muted border rounded-full px-2.5 py-1">
                      {cat.productCount} producto{cat.productCount === 1 ? "" : "s"}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${cat.name}`} onClick={() => openEditFromTab(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${cat.name}`}
                        onClick={() => confirmDeleteCat(cat)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Drawer lateral - only when productos tab active but keep accessible */}
      {selectedProduct && activeTab === "productos" && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedProduct(null)} aria-hidden />
          <div className="w-full max-w-[480px] bg-card border-l border-border shadow-xl flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold truncate">{selectedProduct.name}</h2>
                <p className="text-sm text-muted-foreground">
                  SKU: {selectedProduct.sku} {selectedProduct.barcode ? `· Barcode: ${selectedProduct.barcode}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-medium">${Number(selectedProduct.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  {(() => {
                    const isWeightDrawer = selectedProduct.isSoldByWeight === true || (selectedProduct.unit ?? "").toLowerCase() === "kg";
                    const unitLabel = isWeightDrawer ? "kg" : "un.";
                    const stockStr = Number(selectedProduct.stock).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
                    const minStr = selectedProduct.minStock != null ? Number(selectedProduct.minStock).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : null;
                    const isLow = selectedProduct.minStock != null ? selectedProduct.stock <= selectedProduct.minStock : selectedProduct.stock <= 5;
                    return (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          selectedProduct.stock <= 0
                            ? "bg-zinc-100 text-zinc-600 border-zinc-300"
                            : isLow
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-green-100 text-green-700 border-green-200"
                        }`}
                      >
                        Stock: {stockStr} {unitLabel}
                        {minStr != null ? ` (mín: ${minStr} ${unitLabel})` : ""}
                        {isLow && selectedProduct.stock > 0 ? " · ¡Poco stock!" : ""}
                        {selectedProduct.stock <= 0 && " · Sin stock"}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedProduct(null)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {/* Botones Ajustar */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setAdjustTarget(selectedProduct);
                    setAdjustError(null);
                  }}
                >
                  Ajustar stock (+/-)
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleDelete(selectedProduct)}>
                  Eliminar
                </Button>
              </div>

              {/* Historial con tabs Stock | Precios */}
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4" /> Historial
                </h3>
                <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                  <button
                    onClick={() => setPriceHistoryTab("stock")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${priceHistoryTab === "stock" ? "bg-card shadow border" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Stock
                  </button>
                  <button
                    onClick={async () => {
                      setPriceHistoryTab("precios");
                      if (priceHistory.length === 0 && !priceHistoryLoading && selectedProduct) {
                        setPriceHistoryLoading(true);
                        setPriceHistoryError(null);
                        try {
                          const res = await getProductPriceHistory(selectedProduct.id, { pageSize: 20 });
                          setPriceHistory(res.items);
                        } catch (e) {
                          const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar historial de precios";
                          setPriceHistoryError(msg);
                        } finally {
                          setPriceHistoryLoading(false);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${priceHistoryTab === "precios" ? "bg-card shadow border" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <DollarSign className="h-3 w-3" /> Precios
                  </button>
                </div>

                {priceHistoryTab === "stock" ? (
                  auditsLoading ? (
                    <div className="py-4 flex flex-col gap-2">
                      <div className="h-10 bg-muted rounded animate-pulse" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </div>
                  ) : auditsError ? (
                    <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{auditsError}</p>
                  ) : audits.length === 0 ? (
                    <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">Sin movimientos</p>
                  ) : (
                    <div className="border border-border rounded-lg divide-y divide-border max-h-[260px] overflow-auto">
                      {audits.map((a) => (
                        <div key={a.id} className="p-3 flex justify-between items-center text-sm">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">
                              {new Date(a.adjustedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                            <span className="truncate max-w-[180px]">{a.reason}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-bold ${a.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                              {a.delta > 0 ? `+${a.delta}` : a.delta}
                            </span>
                            <span className="text-xs text-muted-foreground">→ {a.resultingStock}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : priceHistoryLoading ? (
                  <div className="py-4 flex flex-col gap-2">
                    <div className="h-10 bg-muted rounded animate-pulse" />
                    <div className="h-10 bg-muted rounded animate-pulse" />
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  </div>
                ) : priceHistoryError ? (
                  <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{priceHistoryError}</p>
                ) : priceHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">Sin cambios de precio aún</p>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-[320px] overflow-auto">
                    <div className="grid grid-cols-[auto_1fr_auto] gap-2 px-3 py-1.5 bg-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
                      <span>Fecha</span>
                      <span className="text-center">Anterior → Nuevo</span>
                      <span className="text-right">Variación</span>
                    </div>
                    {priceHistory.map((h) => {
                      const isUp = h.newPrice > h.oldPrice;
                      const isDown = h.newPrice < h.oldPrice;
                      return (
                        <div key={h.id} className="px-3 py-2.5 flex flex-col gap-1 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              {new Date(h.changedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${isUp ? "bg-green-50 text-green-700 border-green-200" : isDown ? "bg-red-50 text-red-700 border-red-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"}`}
                            >
                              {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
                              {h.changePercent === 0 ? "0%" : `${h.changePercent > 0 ? "+" : ""}${h.changePercent.toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">
                              <span className="text-muted-foreground line-through">${Number(h.oldPrice).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                              <span className="mx-1">→</span>
                              <span className="font-semibold">${Number(h.newPrice).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                            </span>
                            {h.reason ? <span className="text-xs text-muted-foreground truncate max-w-[120px]">{h.reason}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Edición rápida */}
              <section className="flex flex-col gap-3 border border-border rounded-lg p-4 bg-muted/20">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Edición rápida
                </h3>
                <div>
                  <label className="text-xs font-medium">Nombre *</label>
                  <Input
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    maxLength={50}
                    placeholder="Nombre"
                    className="bg-card border-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Precio *</label>
                  <Input
                    type="number"
                    value={quickPrice}
                    onChange={(e) => setQuickPrice(e.target.value)}
                    placeholder="0.00"
                    className="bg-card border-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Modo de venta</label>
                  <div className="flex gap-2 mt-1">
                    <Select value={quickUnit || "un"} onValueChange={(v) => setQuickUnit(v as "un" | "kg")}>
                      <SelectTrigger className="flex-1 bg-card border-input">
                        <SelectValue placeholder="Modo de venta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="un">Por unidad (paquete)</SelectItem>
                        <SelectItem value="kg">A granel por peso (kg)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {quickUnit === "kg" ? "Se vende fraccionado, stock en kg (ej: 0,4 kg)" : "Se vende por unidades enteras (ej: 1 paquete Yerba 1kg)"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium">Stock mínimo</label>
                  <Input
                    type="number"
                    min="0"
                    max="99999"
                    step={quickUnit === "kg" ? "0.001" : "1"}
                    value={quickMinStock}
                    onChange={(e) => setQuickMinStock(e.target.value)}
                    placeholder={quickUnit === "kg" ? "Ej: 2.5 kg" : "Ej: 2 — vacío = 5 por defecto"}
                    className="bg-card border-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">URL de imagen</label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input type="url" value={quickImageUrl} onChange={(e) => setQuickImageUrl(e.target.value)} placeholder="https://..." className="flex-1 bg-card border-input" />
                    {quickImageUrl.trim() && !quickSelectedFile && (
                      <img src={quickImageUrl.trim().startsWith("/") ? `${API_URL}${quickImageUrl.trim()}` : quickImageUrl.trim()} alt="preview" className="h-10 w-10 object-cover rounded border" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">o Subir archivo</label>
                  <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setQuickError(null); if (f) { if (f.size > 5*1024*1024) { setQuickError("Archivo muy grande (máximo 5MB)"); (e.target as HTMLInputElement).value=""; return; } if (f.type && !f.type.startsWith("image/")) { setQuickError("Formato no soportado (solo imágenes)"); (e.target as HTMLInputElement).value=""; return; } } setQuickSelectedFile(f); if (quickPreviewUrl) URL.revokeObjectURL(quickPreviewUrl); if (f) setQuickPreviewUrl(URL.createObjectURL(f)); else setQuickPreviewUrl(null); }} className="bg-card border-input mt-1" />
                  {quickSelectedFile && quickPreviewUrl && (
                    <div className="flex items-center gap-2 mt-2">
                      <img src={quickPreviewUrl} alt="preview file" className="h-12 w-12 object-cover rounded border" />
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setQuickSelectedFile(null); if (quickPreviewUrl) URL.revokeObjectURL(quickPreviewUrl); setQuickPreviewUrl(null); }}>
                        Quitar
                      </Button>
                      <span className="text-xs text-muted-foreground truncate">{quickSelectedFile.name}</span>
                    </div>
                  )}
                  {selectedProduct.imageUrl && !quickSelectedFile && !quickImageUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={selectedProduct.imageUrl.startsWith("/") ? `${API_URL}${selectedProduct.imageUrl}` : selectedProduct.imageUrl} alt="actual" className="h-12 w-12 object-cover rounded border" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                      <span className="text-xs text-muted-foreground">Imagen actual</span>
                    </div>
                  )}
                  {quickSelectedFile && quickImageUrl.trim() && <p className="text-xs text-amber-600 mt-1">Se priorizará el archivo sobre la URL.</p>}
                </div>
                <div>
                  <label className="text-xs font-medium">Descripción</label>
                  <Input
                    value={quickDesc}
                    onChange={(e) => setQuickDesc(e.target.value)}
                    maxLength={500}
                    placeholder="Descripción (opcional)"
                    className="bg-card border-input mt-1"
                  />
                </div>
                {quickError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{quickError}</p>}
                {quickSuccess && <p className="text-sm text-green-700 border border-green-200 bg-green-50 rounded p-2">{quickSuccess}</p>}
                <Button onClick={handleQuickSave} disabled={quickLoading} className="w-full">
                  {quickLoading ? "Guardando…" : "Guardar"}
                </Button>
              </section>

              {/* Categorías */}
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Categorías
                </h3>
                {selectedCats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin categorías asignadas.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCats.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium"
                      >
                        {c.name}
                        <button
                          onClick={() => handleRemove(selectedProduct, c.id)}
                          className="ml-1 hover:text-red-600"
                          aria-label={`Quitar ${c.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Select value={assignCatId} onValueChange={setAssignCatId}>
                    <SelectTrigger className="flex-1 border-input bg-card">
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
                  <Button variant="outline" onClick={handleDrawerAssign} disabled={!assignCatId || assignCatId === "__none"}>
                    Asignar
                  </Button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {unassignedCats.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin categorías disponibles.</p>
                  )}
                  <Button variant="outline" size="sm" onClick={openCreateFromDrawer} className="gap-1.5 w-fit">
                    <Plus className="h-3.5 w-3.5" />
                    Nueva categoría
                  </Button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Stock adjustment modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Ajustar stock — {adjustTarget.name}</h3>
            {(() => {
              const isWeightAdj = adjustTarget.isSoldByWeight === true || (adjustTarget.unit ?? "").toLowerCase() === "kg";
              const unitLabel = isWeightAdj ? "kg" : "un.";
              const stockStr = Number(adjustTarget.stock).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
              return <p className="text-sm text-muted-foreground">SKU: {adjustTarget.sku} · Stock actual: {stockStr} {unitLabel}</p>;
            })()}

            {(() => {
              const isWeightAdj = adjustTarget.isSoldByWeight === true || (adjustTarget.unit ?? "").toLowerCase() === "kg";
              const step = isWeightAdj ? 0.1 : 1;
              const stepStr = isWeightAdj ? "0.1" : "1";
              return (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium">Delta (+/-) {isWeightAdj ? "(kg, ej: 0.5 o -0.4)" : "(unidades, ej: 5 o -3)"}</label>
                    <Input type="number" step={stepStr} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder={isWeightAdj ? "Ej: 0.5 o -0.4" : "Ej: 5 o -3"} />
                  </div>
                  <Button variant="outline" onClick={() => setDelta(String((parseFloat(delta || "0") - step).toFixed(3).replace(/\.?0+$/, "")))}>
                    -{stepStr}
                  </Button>
                  <Button variant="outline" onClick={() => setDelta(String((parseFloat(delta || "0") + step).toFixed(3).replace(/\.?0+$/, "")))}>
                    +{stepStr}
                  </Button>
                </div>
              );
            })()}

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

      {/* Delete category confirm modal for Categorias tab */}
      {deleteConfirmId && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-semibold">¿Eliminar &quot;{deleteTarget.name}&quot;?</h3>
            <p className="text-sm text-muted-foreground">Se desactivará la categoría. Esta acción no elimina los productos asociados.</p>
            {deleteTarget.productCount > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Esta categoría tiene {deleteTarget.productCount} producto{deleteTarget.productCount === 1 ? "" : "s"} activo
                {deleteTarget.productCount === 1 ? "" : "s"}. Si intentás eliminarla, el servidor responderá con error 409.
              </p>
            )}
            {deleteError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm">{deleteError}</div>}
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleteLoading}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteCategory} disabled={deleteLoading}>
                {deleteLoading ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <CategoryFormModal
        open={showCatModal}
        onClose={closeCatModal}
        onSuccess={handleCategoryCreated}
        editingCategory={editingCategory}
        categories={categories}
      />

      {/* Bulk price adjustment dialog */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Ajuste masivo de precios
              </h3>
              <button onClick={() => setShowBulk(false)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scope */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Categoría</label>
              <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                <SelectTrigger className="w-full max-w-sm border-input bg-card">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Adjustment inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Porcentaje %</label>
                <Input type="number" step="0.01" value={bulkPercentage} onChange={(e) => setBulkPercentage(e.target.value)} placeholder="ej: 15" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Monto fijo $</label>
                <Input type="number" step="0.01" value={bulkFixed} onChange={(e) => setBulkFixed(e.target.value)} placeholder="ej: 500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Al menos uno debe ser distinto de 0. Negativo para rebaja.</p>

            {/* Reason */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Motivo (3..500)</label>
              <Input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} maxLength={500} placeholder="Ej: Inflación agosto 2026" />
              <span className="text-xs text-muted-foreground text-right">{bulkReason.trim().length}/500</span>
            </div>

            {/* Preview table */}
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left w-10">
                        <input
                          type="checkbox"
                          checked={bulkAllChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const next: Record<string, boolean> = {};
                            bulkPreview.forEach((b) => (next[b.id] = checked));
                            setBulkSelected(next);
                          }}
                        />
                      </th>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-right">Anterior</th>
                      <th className="p-2 text-right">Nuevo</th>
                      <th className="p-2 text-center">Variación</th>
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
                          <tr key={b.id} className={`border-t border-border ${!checked ? "opacity-50" : ""}`}>
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setBulkSelected((prev) => ({ ...prev, [b.id]: e.target.checked }))}
                              />
                            </td>
                            <td className="p-2 font-mono text-xs">{b.sku}</td>
                            <td className="p-2 truncate max-w-[180px]" title={b.name}>
                              {b.name}
                            </td>
                            <td className="p-2 text-right">${b.oldPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-right font-bold">${b.newPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-center">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${
                                  isIncrease ? "bg-green-50 text-green-700 border-green-200" : isDecrease ? "bg-red-50 text-red-700 border-red-200" : "bg-muted text-muted-foreground"
                                }`}
                              >
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

            {/* Footer */}
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Afectados: {bulkPreviewFiltered.length}</div>
              {bulkError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm">{bulkError}</div>}
              {bulkSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-2 text-sm">{bulkSuccess}</div>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowBulk(false)} disabled={bulkLoading}>
                  Cerrar
                </Button>
                <Button
                  onClick={handleBulkConfirm}
                  disabled={bulkLoading || bulkPreviewFiltered.length === 0 || !bulkHasAdjustment || bulkReason.trim().length < 3}
                >
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
    <Suspense fallback={<main className="p-4 text-sm text-muted-foreground">Cargando inventario…</main>}>
      <InventarioPageContent />
    </Suspense>
  );
}
