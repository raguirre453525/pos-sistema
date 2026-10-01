"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Upload, Link2 } from "lucide-react";
import CategoryFormModal from "@/components/Categorias/CategoryFormModal";
import { createProduct, adjustStock, assignCategory, getCategories, uploadProductImage, CategoryDto, ApiError } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: CategoryDto[];
  onCategoriesRefresh: () => Promise<void | CategoryDto[]>;
};

export default function NewProductModal({ open, onClose, onSuccess, categories, onCategoriesRefresh }: Props) {
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<"un" | "kg">("un");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [localCats, setLocalCats] = useState<CategoryDto[]>(categories);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalCats(categories);
  }, [categories]);

  useEffect(() => {
    if (open) {
      // autofocus nombre
      setTimeout(() => nameRef.current?.focus(), 50);
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !loading && !showCatModal) onClose();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [open, loading, showCatModal, onClose]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  const activeCategories = localCats.filter((c) => c.isActive);

  const handleAutogenerateSku = () => {
    // digits only per SKU validation ^\d+$
    const random = Math.floor(10000000 + Math.random() * 90000000).toString();
    setSku(random);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f) {
      if (f.size > 5 * 1024 * 1024) { setError("Archivo muy grande (máximo 5MB)"); (e.target as HTMLInputElement).value = ""; return; }
      if (f.type && !f.type.startsWith("image/")) { setError("Formato no soportado (solo imágenes)"); (e.target as HTMLInputElement).value = ""; return; }
    }
    setSelectedFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  };

  const handleCategoryCreated = async (cat: CategoryDto) => {
    await onCategoriesRefresh();
    // also update local
    const fresh = await getCategories().catch(() => localCats);
    setLocalCats(fresh);
    setSelectedCategoryId(cat.id);
    setShowCatModal(false);
  };

  const isKg = unit === "kg";

  const validate = (): string | null => {
    if (!sku.trim()) return "SKU es obligatorio";
    if (!name.trim()) return "Nombre es obligatorio";
    if (name.trim().length > 50) return "Nombre no puede exceder 50 caracteres";
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) return "Precio debe ser >= 0";
    const stockNum = parseFloat(stock || "0");
    if (isNaN(stockNum) || stockNum < 0) return "Stock debe ser >= 0";
    if (isKg) {
      if (Math.round(stockNum * 1000) / 1000 !== stockNum) return "Stock a granel no puede tener más de 3 decimales";
    } else {
      if (!Number.isInteger(stockNum)) return "Stock por unidad debe ser entero";
    }
    if (minStock.trim() !== "") {
      const v = parseFloat(minStock);
      if (isNaN(v) || v < 0 || v > 99999) return "Stock mínimo debe estar entre 0 y 99999";
      if (isKg) {
        if (Math.round(v * 1000) / 1000 !== v) return "Stock mínimo a granel no puede tener más de 3 decimales";
      } else if (!Number.isInteger(v)) return "Stock mínimo por unidad debe ser entero";
    }
    return null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }
    const priceNum = parseFloat(price);
    const stockNum = parseFloat(stock || "0");
    let minStockNum: number | null = null;
    if (minStock.trim() !== "") minStockNum = parseFloat(minStock);
    setLoading(true);
    try {
      const product = await createProduct({
        sku: sku.trim(),
        name: name.trim(),
        price: priceNum,
        barcode: barcode.trim() || null,
        description: description.trim() || null,
        imageUrl: selectedFile ? null : (imageUrl.trim() || null),
        unit: unit || null,
        minStock: minStockNum,
      });
      if (selectedFile) {
        try {
          await uploadProductImage(product.id, selectedFile);
        } catch (uploadErr) {
          const msg = uploadErr instanceof ApiError ? uploadErr.message : uploadErr instanceof Error ? uploadErr.message : "Error al subir imagen";
          // no bloquea, avisa pero continúa
          console.warn("Imagen upload failed:", msg);
        }
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      }
      if (stockNum > 0) {
        await adjustStock(product.id, { delta: stockNum, reason: "Stock inicial" });
      }
      if (selectedCategoryId) {
        try {
          await assignCategory(product.id, selectedCategoryId);
        } catch (catErr) {
          const msg = catErr instanceof ApiError ? catErr.message : catErr instanceof Error ? catErr.message : "Error al asignar categoría";
          console.warn("Assign category failed:", msg);
        }
      }
      // reset
      setSku("");
      setBarcode("");
      setName("");
      setPrice("");
      setStock("0");
      setMinStock("");
      setDescription("");
      setUnit("un");
      setImageUrl("");
      setSelectedFile(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      setSelectedCategoryId("");
      setError(null);
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Error al crear producto";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Enter confirma si campos obligatorios válidos
      const target = e.target as HTMLElement;
      if (target.tagName !== "TEXTAREA" && target.tagName !== "BUTTON") {
        e.preventDefault();
        void handleSubmit();
      }
    }
  };

  const handleOverlayClick = () => {
    if (!loading) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleOverlayClick}>
      <div
        className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo Producto"
      >
        {/* Cabecera limpia */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-4 border-b border-slate-100 dark:border-border sm:px-6 sm:pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">Nuevo Producto</h2>
            <p className="text-sm text-muted-foreground">Completá los datos para agregar un producto al inventario</p>
          </div>
          <button onClick={onClose} className="h-11 w-11 shrink-0 rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors sm:h-8 sm:w-8" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="grid grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 md:grid-cols-2">
            {/* Columna Izquierda - Datos Principales */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Código interno / SKU *</label>
                <div className="flex h-11 w-full sm:h-9">
                  <Input
                    aria-label="Código interno / SKU"
                    placeholder="Ej: PROD-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="flex-1 h-11 bg-slate-50 dark:bg-muted/40 border-slate-200 dark:border-border rounded-l-xl rounded-r-none border-r-0 focus:bg-white font-mono text-sm focus:z-10 focus:ring-1 focus:ring-ring sm:h-9"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAutogenerateSku}
                    className="shrink-0 rounded-l-none rounded-r-xl h-11 px-3 text-xs border border-slate-200 dark:border-border -ml-px bg-slate-50 dark:bg-muted/40 hover:bg-slate-100 dark:hover:bg-muted font-medium sm:h-9"
                    title="Autogenerar SKU"
                  >
                    Auto
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Código de barras / EAN (opcional)</label>
                <Input
                  aria-label="Código de barras / EAN"
                  placeholder="Escanear o ingresar ej: 779..."
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  autoComplete="off"
                  inputMode="numeric"
                  type="text"
                  className="h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm font-mono sm:h-9"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Nombre del producto *</label>
                <Input
                  ref={nameRef}
                  aria-label="Nombre del producto"
                  placeholder="Ej: Yerba Playadito 1kg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  className="h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm focus:bg-white sm:h-9"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Categoría</label>
                <div className="flex items-center gap-2">
                  <Select value={selectedCategoryId || "__none"} onValueChange={(v) => setSelectedCategoryId(v === "__none" ? "" : v)}>
                    <SelectTrigger aria-label="Categoría" className="flex-1 h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm sm:h-9">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sin categoría</SelectItem>
                      {activeCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowCatModal(true)} className="shrink-0 gap-1 h-11 rounded-xl sm:h-8">
                    <Plus className="h-3.5 w-3.5" /> Nueva
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Modo de venta</label>
                <div className="flex gap-1 bg-slate-100 dark:bg-muted p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setUnit("un")}
                    className={`min-h-11 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors sm:min-h-0 ${unit === "un" ? "bg-white dark:bg-card shadow-sm border border-slate-200 dark:border-border text-slate-900 dark:text-foreground" : "text-slate-600 dark:text-muted-foreground hover:text-foreground"}`}
                  >
                    Unidad
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit("kg")}
                    className={`min-h-11 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors sm:min-h-0 ${unit === "kg" ? "bg-white dark:bg-card shadow-sm border border-slate-200 dark:border-border text-slate-900 dark:text-foreground" : "text-slate-600 dark:text-muted-foreground hover:text-foreground"}`}
                  >
                    Granel-Kg
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-tight">
                  {isKg ? "Se vende fraccionado, stock en kg (ej: 0,4 kg)" : "Se vende por unidades enteras"}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-product-description" className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Descripción (opcional)</label>
                <Input
                  id="new-product-description"
                  placeholder="Detalle breve"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  className="h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm sm:h-9"
                />
              </div>
            </div>

            {/* Columna Derecha - Valores Comerciales e Imagen */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-product-price" className="text-xs font-semibold text-slate-700 dark:text-foreground">Precio de Venta *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                  <Input
                    id="new-product-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pl-7 h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl font-bold font-mono text-lg tabular-nums focus:bg-white sm:h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="new-product-stock" className="text-xs font-semibold text-slate-700 dark:text-foreground">Stock Inicial</label>
                  <Input
                    id="new-product-stock"
                    type="number"
                    min="0"
                    step={isKg ? "0.001" : "1"}
                    placeholder={isKg ? "0.0" : "0"}
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm tabular-nums sm:h-9"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="new-product-min-stock" className="text-xs font-semibold text-slate-700 dark:text-foreground">Stock Mínimo</label>
                  <Input
                    id="new-product-min-stock"
                    type="number"
                    min="0"
                    max="99999"
                    step={isKg ? "0.001" : "1"}
                    placeholder={isKg ? "Ej: 2.5" : "Ej: 5"}
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm tabular-nums sm:h-9"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Alerta cuando el stock llegue al mínimo</p>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-foreground">Imagen</label>
                <div className="flex gap-3 items-start">
                  <div className="h-20 w-20 rounded-xl bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border flex items-center justify-center overflow-hidden shrink-0">
                    {previewUrl ? (
                      <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />
                    ) : imageUrl.trim() ? (
                      <img src={imageUrl.trim().startsWith("/") ? imageUrl.trim() : imageUrl.trim()} alt="preview url" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    ) : (
                      <Upload className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <label className="inline-flex items-center justify-center gap-2 h-11 px-3 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-sm font-medium cursor-pointer sm:h-9">
                      <Upload className="h-4 w-4" />
                      Subir archivo
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <div className="relative">
                      <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        aria-label="URL de imagen"
                        type="url"
                        placeholder="o pegar URL https://..."
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="pl-8 h-11 bg-white dark:bg-card border-slate-200 dark:border-border rounded-xl text-sm sm:h-9"
                      />
                    </div>
                    {(selectedFile || imageUrl.trim()) && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground truncate flex-1">{selectedFile?.name || imageUrl.trim()}</span>
                        <button
                          type="button"
                          onClick={() => { setSelectedFile(null); setImageUrl(""); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}
                          className="min-h-11 min-w-11 shrink-0 px-2 text-xs text-red-600 hover:underline sm:min-h-0 sm:min-w-0"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                    {selectedFile && imageUrl.trim() && <p className="text-xs text-amber-600 leading-tight">Se priorizará el archivo sobre la URL.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm sm:mx-6">
              {error}
            </div>
          )}

          {/* Footer fijo */}
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-4 dark:border-border dark:bg-muted/20 sm:flex-row sm:justify-end sm:px-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="min-h-11 w-full rounded-xl px-5 sm:min-h-0 sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="min-h-11 w-full rounded-xl bg-red-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-red-700 sm:min-h-0 sm:w-auto">
              {loading ? "Guardando…" : "Guardar Producto"}
            </Button>
          </div>
        </form>
      </div>

      <CategoryFormModal
        open={showCatModal}
        onClose={() => setShowCatModal(false)}
        onSuccess={handleCategoryCreated}
        categories={localCats}
      />
    </div>
  );
}
