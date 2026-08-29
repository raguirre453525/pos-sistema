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
  const [unit, setUnit] = useState("");
  const [unitCustom, setUnitCustom] = useState("");
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

  const activeCategories = categories.filter((c) => c.isActive);

  const handleCategoryCreated = async (cat: CategoryDto) => {
    await fetchCategories();
    setSelectedCategoryId(cat.id);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  };

  const resolvedUnit = unit === "Otro" ? unitCustom.trim() : unit.trim();

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
    const stockNum = parseInt(stock || "0", 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setError("Stock debe ser >= 0");
      return;
    }
    if (resolvedUnit && (resolvedUnit.length < 1 || resolvedUnit.length > 20)) {
      setError("Unidad debe tener entre 1 y 20 caracteres");
      return;
    }
    let minStockNum: number | null = null;
    if (minStock.trim() !== "") {
      minStockNum = parseInt(minStock, 10);
      if (isNaN(minStockNum) || minStockNum < 0 || minStockNum > 99999) {
        setError("Stock mínimo debe estar entre 0 y 99999");
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
        try {
          await uploadProductImage(product.id, selectedFile);
        } catch (uploadErr) {
          const msg = uploadErr instanceof ApiError ? uploadErr.message : uploadErr instanceof Error ? uploadErr.message : "Error al subir imagen";
          setError(`Producto creado, pero falló subir imagen: ${msg}`);
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
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sku">SKU *</FieldLabel>
            <Input id="sku" placeholder="PROD-001" value={sku} onChange={(e) => setSku(e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Nombre *</FieldLabel>
            <Input id="name" placeholder="Aceite" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} />
          </Field>
          <Field>
            <FieldLabel htmlFor="barcode">Barcode (opcional)</FieldLabel>
            <Input id="barcode" placeholder="779..." value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Unidad</FieldLabel>
            <div className="flex gap-2">
              <Select value={unit || "__none"} onValueChange={(v) => setUnit(v === "__none" ? "" : v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin unidad</SelectItem>
                  <SelectItem value="un">Unidad</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="lt">Litro</SelectItem>
                  <SelectItem value="pack">Pack</SelectItem>
                  <SelectItem value="caja">Caja</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
              {unit === "Otro" && (
                <Input placeholder="Ej: metro" value={unitCustom} onChange={(e) => setUnitCustom(e.target.value)} className="flex-1" maxLength={20} />
              )}
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="minStock">Stock mínimo</FieldLabel>
            <Input id="minStock" type="number" min="0" max="99999" placeholder="Ej: 5 — vacío = 5 por defecto" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="imageUrl">URL de imagen</FieldLabel>
            <div className="flex gap-2 items-center">
              <Input id="imageUrl" type="url" placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1" />
              {imageUrl.trim() && !selectedFile && (
                <img src={imageUrl.trim()} alt="preview url" className="h-10 w-10 object-cover rounded border" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              )}
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="picture">o Subir archivo</FieldLabel>
            <Input id="picture" type="file" accept="image/*" onChange={handleFileChange} />
            {selectedFile && previewUrl && (
              <div className="flex items-center gap-2 mt-2">
                <img src={previewUrl} alt="preview file" className="h-16 w-16 object-cover rounded border" />
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); (document.getElementById("picture") as HTMLInputElement | null)?.value && ((document.getElementById("picture") as HTMLInputElement).value = ""); }}>
                  Quitar
                </Button>
                <span className="text-xs text-muted-foreground truncate">{selectedFile.name}</span>
              </div>
            )}
            {selectedFile && imageUrl.trim() && <p className="text-xs text-amber-600">Se priorizará el archivo sobre la URL.</p>}
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Descripción (opcional)</FieldLabel>
            <Input id="description" placeholder="Detalle" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </Field>
          <Field>
            <FieldLabel htmlFor="precio">Precio *</FieldLabel>
            <Input id="precio" type="number" step="0.01" min="0" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="stock">Stock inicial</FieldLabel>
            <Input id="stock" type="number" min="0" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
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
                  <SelectTrigger className="flex-1">
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCatModal(true)} className="gap-1 shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                  Nueva categoría
                </Button>
              </div>
            )}
          </Field>

          {error && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{error}</p>}
          <Field orientation="horizontal">
            <Button
              type="reset"
              variant="outline"
              onClick={() => {
                setSku("");
                setName("");
                setPrice("");
                setStock("0");
                setBarcode("");
                setDescription("");
                setUnit("");
                setUnitCustom("");
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
            <Button type="submit" disabled={loading}>
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
