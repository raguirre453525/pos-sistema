"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import CategoryFormModal from "@/components/Categorias/CategoryFormModal";
import { createProduct, adjustStock, getCategories, assignCategory, CategoryDto, ApiError } from "@/lib/api";

export function NewProductForm() {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
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

    setLoading(true);
    try {
      const product = await createProduct({
        sku: sku.trim(),
        name: name.trim(),
        price: priceNum,
        barcode: barcode.trim() || null,
        description: description.trim() || null,
      });
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
