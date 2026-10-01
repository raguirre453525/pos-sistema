"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import CategoryFormModal from "@/components/Categorias/CategoryFormModal";
import { createProduct, adjustStock, getCategories, assignCategory, uploadProductImage, CategoryDto, ApiError, API_URL } from "@/lib/api";

export function NewProductForm() {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<"un" | "kg">("un");
  const [minStock, setMinStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [catLoading, setCatLoading] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);

  const fetchCategories = async () => {
    setCatLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {
      setCategories([]);
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    void fetchCategories();
  }, []);

  // FIX: revoca objectURL al desmontar / cambio de preview para evitar leak que podía colgar la app al editar
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const activeCategories = categories.filter((c) => c.isActive);

  const handleCategoryCreated = async (cat: CategoryDto) => {
    await fetchCategories();
    setSelectedCategoryId(cat.id);
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

  const isKg = unit === "kg";
  const resolvedUnit: "un" | "kg" = unit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sku.trim()) {
      setError("SKU es obligatorio");
      return;
    }
    if (!name.trim()) {
      setError("Nombre es obligatorio");
      return;
    }
    if (name.trim().length > 50) {
      setError("Nombre no puede exceder 50 caracteres");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Precio debe ser >= 0");
      return;
    }
    const stockNum = parseFloat(stock || "0");
    if (isNaN(stockNum) || stockNum < 0) {
      setError("Stock debe ser >= 0");
      return;
    }
    if (isKg) {
      if (Math.round(stockNum * 1000) / 1000 !== stockNum) {
        setError("Stock a granel no puede tener más de 3 decimales");
        return;
      }
    } else {
      if (!Number.isInteger(stockNum)) {
        setError("Stock por unidad debe ser entero");
        return;
      }
    }
    if (resolvedUnit !== "un" && resolvedUnit !== "kg") {
      setError("Modo de venta debe ser 'un' o 'kg'");
      return;
    }
    let minStockNum: number | null = null;
    if (minStock.trim() !== "") {
      minStockNum = parseFloat(minStock);
      if (isNaN(minStockNum) || minStockNum < 0 || minStockNum > 99999) {
        setError("Stock mínimo debe estar entre 0 y 99999");
        return;
      }
      if (isKg) {
        if (Math.round(minStockNum * 1000) / 1000 !== minStockNum) {
          setError("Stock mínimo a granel no puede tener más de 3 decimales");
          return;
        }
      } else if (!Number.isInteger(minStockNum)) {
        setError("Stock mínimo por unidad debe ser entero");
        return;
      }
    }

    setLoading(true);
    try {
      if (selectedFile && imageUrl.trim()) {
        // prioritize file, but keep warning via error? we just proceed, file wins
      }
      const product = await createProduct({
        sku: sku.trim(),
        name: name.trim(),
        price: priceNum,
        barcode: barcode.trim() || null,
        description: description.trim() || null,
        imageUrl: selectedFile ? null : (imageUrl.trim() || null),
        unit: resolvedUnit || null,
        minStock: minStockNum,
      });
      if (selectedFile) {
        // FIX: validación previa + try/catch evita que error no atrapado cierre la app (crash reportado al editar/cambiar imagen)
        if (selectedFile.size > 5 * 1024 * 1024) {
          setError("Producto creado, pero falló subir imagen: Archivo muy grande (máximo 5MB)");
        } else if (selectedFile.type && !selectedFile.type.startsWith("image/")) {
          setError("Producto creado, pero falló subir imagen: Formato no soportado (solo imágenes)");
        } else {
          try {
            await uploadProductImage(product.id, selectedFile);
          } catch (uploadErr) {
            const msg = uploadErr instanceof ApiError ? uploadErr.message : uploadErr instanceof Error ? uploadErr.message : "Error al subir imagen";
            setError(`Producto creado, pero falló subir imagen: ${msg}`);
          } finally {
            if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
          }
        }
      }
      if (stockNum > 0) {
        await adjustStock(product.id, { delta: stockNum, reason: "Stock inicial" });
      }
      if (selectedCategoryId) {
        try {
          await assignCategory(product.id, selectedCategoryId);
        } catch (catErr) {
          const msg =
            catErr instanceof ApiError
              ? catErr.message
              : catErr instanceof Error
                ? catErr.message
                : "Error al asignar categoría";
          setError(`Producto creado, pero falló asignar categoría: ${msg}`);
          // still navigate after warning
          setTimeout(() => router.push("/Inventario"), 800);
          setLoading(false);
          return;
        }
      }
      router.push("/Inventario");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Error al crear producto";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <FieldGroup className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="sku">SKU *</FieldLabel>
            <Input id="sku" placeholder="PROD-001" value={sku} onChange={(e) => setSku(e.target.value)} required className="h-11 sm:h-9" />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Nombre *</FieldLabel>
            <Input id="name" placeholder="Aceite" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} className="h-11 sm:h-9" />
          </Field>
          <Field>
            <FieldLabel htmlFor="barcode">Barcode (opcional)</FieldLabel>
            <Input id="barcode" placeholder="779..." value={barcode} onChange={(e) => setBarcode(e.target.value)} className="h-11 sm:h-9" />
          </Field>
          <Field>
            <FieldLabel>Modo de venta</FieldLabel>
            <Select value={unit} onValueChange={(v) => setUnit(v as "un" | "kg")}>
              <SelectTrigger className="h-11 flex-1 sm:h-8">
                <SelectValue placeholder="Modo de venta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="un">Por unidad (paquete)</SelectItem>
                <SelectItem value="kg">A granel por peso (kg)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isKg ? "Se vende fraccionado, stock en kg (ej: 0,4 kg)" : "Se vende por unidades enteras (ej: 1 paquete Yerba 1kg)"}
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="minStock">Stock mínimo</FieldLabel>
            <Input
              id="minStock"
              type="number"
              min="0"
              max="99999"
              step={isKg ? "0.001" : "1"}
              placeholder={isKg ? "Ej: 2.5 kg" : "Ej: 2"}
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="h-11 sm:h-8"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="imageUrl">URL de imagen</FieldLabel>
            <div className="flex gap-2 items-center">
              <Input id="imageUrl" type="url" placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="h-11 flex-1 sm:h-8" />
              {imageUrl.trim() && !selectedFile && (
                <img src={imageUrl.trim()} alt="preview url" className="h-10 w-10 object-cover rounded border" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              )}
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="picture">o Subir archivo</FieldLabel>
            <Input id="picture" type="file" accept="image/*" onChange={handleFileChange} className="h-11 sm:h-8" />
            {selectedFile && previewUrl && (
              <div className="flex items-center gap-2 mt-2">
                <img src={previewUrl} alt="preview file" className="h-16 w-16 object-cover rounded border" />
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); (document.getElementById("picture") as HTMLInputElement | null)?.value && ((document.getElementById("picture") as HTMLInputElement).value = ""); }} className="h-11 sm:h-8">
                  Quitar
                </Button>
                <span className="text-xs text-muted-foreground truncate">{selectedFile.name}</span>
              </div>
            )}
            {selectedFile && imageUrl.trim() && <p className="text-xs text-amber-600">Se priorizará el archivo sobre la URL.</p>}
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Descripción (opcional)</FieldLabel>
            <Input id="description" placeholder="Detalle" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="h-11 sm:h-8" />
          </Field>
          <Field>
            <FieldLabel htmlFor="precio">Precio *</FieldLabel>
            <Input id="precio" type="number" step="0.01" min="0" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} required className="h-11 sm:h-8" />
          </Field>
          <Field>
            <FieldLabel htmlFor="stock">Stock inicial</FieldLabel>
            <Input id="stock" type="number" min="0" step={isKg ? "0.001" : "1"} placeholder={isKg ? "Ej: 15.5" : "Ej: 10"} value={stock} onChange={(e) => setStock(e.target.value)} className="h-11 sm:h-8" />
            <p className="text-xs text-muted-foreground">Se creará con 0 y luego se ajusta si es &gt;0.</p>
          </Field>

          <Field>
            <FieldLabel>Categoría</FieldLabel>
            {catLoading ? (
              <p className="text-xs text-muted-foreground">Cargando categorías…</p>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedCategoryId || "__none"}
                  onValueChange={(v) => setSelectedCategoryId(v === "__none" ? "" : v)}
                >
                <SelectTrigger className="h-11 flex-1 sm:h-8">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin categoría</SelectItem>
                    {activeCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCatModal(true)} className="h-11 gap-1 shrink-0 sm:h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Nueva categoría
                </Button>
              </div>
            )}
          </Field>

          {error && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2 md:col-span-2">{error}</p>}
          <Field orientation="horizontal" className="flex-col-reverse md:col-span-2 sm:flex-row sm:justify-end">
            <Button
              type="reset"
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => {
                setSku("");
                setName("");
                setPrice("");
                setStock("0");
                setBarcode("");
                setDescription("");
                setUnit("un");
                setMinStock("");
                setImageUrl("");
                setSelectedFile(null);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setSelectedCategoryId("");
                setError(null);
              }}
            >
              Resetear
            </Button>
            <Button type="submit" disabled={loading} className="h-11 w-full sm:h-9 sm:w-auto">
              {loading ? "Creando…" : "Crear"}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <CategoryFormModal
        open={showCatModal}
        onClose={() => setShowCatModal(false)}
        onSuccess={handleCategoryCreated}
        categories={categories}
      />
    </>
  );
}

export default NewProductForm;
