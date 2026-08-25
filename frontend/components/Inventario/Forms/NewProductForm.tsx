"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createProduct, adjustStock, ApiError } from "@/lib/api";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sku.trim()) { setError("SKU es obligatorio"); return; }
    if (!name.trim()) { setError("Nombre es obligatorio"); return; }
    if (name.trim().length > 50) { setError("Nombre no puede exceder 50 caracteres"); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { setError("Precio debe ser >= 0"); return; }
    const stockNum = parseInt(stock || "0", 10);
    if (isNaN(stockNum) || stockNum < 0) { setError("Stock debe ser >= 0"); return; }

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
      router.push("/Inventario");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Error al crear producto";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
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
        {error && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{error}</p>}
        <Field orientation="horizontal">
          <Button type="reset" variant="outline" onClick={() => { setSku(""); setName(""); setPrice(""); setStock("0"); setBarcode(""); setDescription(""); setError(null); }}>
            Resetear
          </Button>
          <Button type="submit" disabled={loading}>{loading ? "Creando…" : "Crear"}</Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

export default NewProductForm;
