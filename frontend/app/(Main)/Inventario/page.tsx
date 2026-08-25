"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import StatCard from "@/components/Dashboard/StatCard";
import DataTable from "@/components/Reusables/DataTable";
import { createProductColumns } from "@/components/Inventario/DataTable/productColumns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Package, PackagePlus, Tag, Pencil, Trash2 } from "lucide-react";
import {
  getProducts,
  adjustStock,
  deleteProduct,
  ProductDto,
  ApiError,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryProducts,
  assignCategory,
  removeCategory,
  CategoryDto,
} from "@/lib/api";

export default function InventarioPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adjustTarget, setAdjustTarget] = useState<ProductDto | null>(null);
  const [delta, setDelta] = useState<string>("1");
  const [reason, setReason] = useState<string>("Ajuste manual");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Categories state
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [productCategories, setProductCategories] = useState<Record<string, CategoryDto[]>>({});
  const [productCatLoading, setProductCatLoading] = useState(false);

  // Category management
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatLoading, setNewCatLoading] = useState(false);
  const [newCatError, setNewCatError] = useState<string | null>(null);

  const [editingCat, setEditingCat] = useState<CategoryDto | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [catActionError, setCatActionError] = useState<string | null>(null);

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
          // push the canonical category from cats list (to keep isActive etc consistent)
          const canonical = cats.find((x) => x.id === cat.id) ?? cat;
          map[p.id].push(canonical);
        });
      });
      setProductCategories(map);
    } finally {
      setProductCatLoading(false);
    }
  }, []);

  // initial load
  useEffect(() => {
    void fetchProducts();
    void fetchCategoriesInternal().then((cats) => {
      void rebuildProductCategories(cats);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [fetchProducts, fetchCategoriesInternal, rebuildProductCategories]);

  // when categories change externally (after assign/remove we refetch), keep map in sync
  // we handle it explicitly in handlers, but also keep effect for catLoading false case where productCat missing?
  // no extra effect needed

  const refreshCategoriesAndMap = useCallback(async () => {
    const cats = await fetchCategoriesInternal();
    await rebuildProductCategories(cats);
  }, [fetchCategoriesInternal, rebuildProductCategories]);

  const totalValue = useMemo(() => products.reduce((acc, p) => acc + p.price * p.stock, 0), [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategoryId === "all") return products;
    return products.filter((p) => (productCategories[p.id] ?? []).some((c) => c.id === selectedCategoryId));
  }, [products, selectedCategoryId, productCategories]);

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
      // refresh categories counts after delete
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

  const handleCreateCategory = async () => {
    const name = newCatName.trim();
    const desc = newCatDesc.trim();
    setNewCatError(null);
    if (!name) {
      setNewCatError("Nombre es obligatorio");
      return;
    }
    if (name.length > 100) {
      setNewCatError("Nombre no puede exceder 100 caracteres");
      return;
    }
    if (desc.length > 500) {
      setNewCatError("Descripción no puede exceder 500 caracteres");
      return;
    }
    setNewCatLoading(true);
    try {
      await createCategory({ name, description: desc || null });
      setNewCatName("");
      setNewCatDesc("");
      await refreshCategoriesAndMap();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al crear categoría";
      // ApiError 409 for duplicate
      setNewCatError(msg);
    } finally {
      setNewCatLoading(false);
    }
  };

  const startEdit = (cat: CategoryDto) => {
    setEditingCat(cat);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
    setEditError(null);
  };

  const handleUpdateCategory = async () => {
    if (!editingCat) return;
    const name = editName.trim();
    const desc = editDesc.trim();
    setEditError(null);
    if (!name) {
      setEditError("Nombre es obligatorio");
      return;
    }
    if (name.length > 100) {
      setEditError("Nombre no puede exceder 100 caracteres");
      return;
    }
    if (desc.length > 500) {
      setEditError("Descripción no puede exceder 500 caracteres");
      return;
    }
    setEditLoading(true);
    try {
      await updateCategory(editingCat.id, { name, description: desc || null });
      setEditingCat(null);
      await refreshCategoriesAndMap();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al actualizar";
      setEditError(msg);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryDto) => {
    if (!confirm(`¿Eliminar categoría "${cat.name}"? ${cat.productCount > 0 ? `Tiene ${cat.productCount} producto(s) asociado(s) — la operación fallará con 409 si tiene productos activos.` : ""}`)) return;
    setCatActionError(null);
    try {
      await deleteCategory(cat.id);
      // if filtered by deleted category, reset
      if (selectedCategoryId === cat.id) setSelectedCategoryId("all");
      await refreshCategoriesAndMap();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al eliminar categoría";
      // backend 409 when has active products
      setCatActionError(msg);
      if (e instanceof ApiError && e.status === 409) {
        alert(`No se puede eliminar "${cat.name}": ${msg}`);
      } else {
        alert(msg);
      }
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
        categoryMap: productCategories,
        categories,
        onAssign: handleAssign,
        onRemove: handleRemove,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productCategories, categories]
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

      {/* Categories management */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5" /> CATEGORÍAS
          </h3>
          <span className="text-xs text-muted-foreground">
            {catLoading ? "Cargando…" : `${categories.length} categorías`}
          </span>
        </div>

        {catError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 mb-3 flex justify-between items-center">
            <span>{catError}</span>
            <Button variant="outline" size="sm" onClick={refreshCategoriesAndMap}>
              Reintentar
            </Button>
          </div>
        )}
        {catActionError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2 mb-3">{catActionError}</p>}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            placeholder="Nombre categoría *"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            maxLength={100}
            className="flex-1"
          />
          <Input
            placeholder="Descripción (opcional)"
            value={newCatDesc}
            onChange={(e) => setNewCatDesc(e.target.value)}
            maxLength={500}
            className="flex-1"
          />
          <Button onClick={handleCreateCategory} disabled={newCatLoading}>
            {newCatLoading ? "Creando…" : "Crear categoría"}
          </Button>
        </div>
        {newCatError && <p className="text-sm text-red-600 mb-3">{newCatError}</p>}

        {catLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando categorías…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No hay categorías. Creá la primera arriba.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <div
                key={c.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm"
              >
                <span className="font-medium">{c.name}</span>
                {c.description && <span className="text-xs text-muted-foreground truncate max-w-[150px]">{c.description}</span>}
                <span className="text-xs bg-background border rounded-full px-1.5 py-0.5">{c.productCount}</span>
                <button
                  aria-label={`Editar ${c.name}`}
                  onClick={() => startEdit(c)}
                  className="ml-1 p-1 rounded hover:bg-background"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  aria-label={`Eliminar ${c.name}`}
                  onClick={() => handleDeleteCategory(c)}
                  className="p-1 rounded hover:bg-red-100 text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card h-full rounded-2xl border border-border shadow-sm p-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              PRODUCTOS{" "}
              {selectedCategoryId !== "all" && (
                <span className="text-sm font-normal text-muted-foreground">— filtrado ({filteredProducts.length})</span>
              )}
              {productCatLoading && <span className="text-xs ml-2 text-muted-foreground">cargando categorías…</span>}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Filtrar por categoría:</span>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.productCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {catActionError && <p className="text-sm text-amber-700 border border-amber-200 bg-amber-50 rounded p-2 mb-3">{catActionError}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Cargando productos…</p>
          ) : (
            <DataTable columns={columns} data={filteredProducts} label="Producto" placeholder="Buscar por SKU, nombre…" />
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

      {/* Edit category modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Editar categoría</h3>
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} placeholder="Nombre" />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={500} placeholder="Descripción (opcional)" />
            </div>
            {editError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{editError}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setEditingCat(null)} disabled={editLoading}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateCategory} disabled={editLoading}>
                {editLoading ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
