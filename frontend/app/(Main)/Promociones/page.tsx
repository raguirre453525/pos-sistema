"use client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { getProducts, getPromotions, createPromotion, updatePromotion, deletePromotion, togglePromotion, type ProductDto, type PromotionDto } from "@/lib/api";
import { Tag, BadgePercent, PackageCheck, Trash2, Pencil, Search, X } from "lucide-react";

type FormState = {
  name: string;
  description: string;
  type: 0 | 1;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  comboPrice: string;
  discountPercentage: string;
  productIds: string[];
};

const emptyForm: FormState = {
  name: "", description: "", type: 0, isActive: true, validFrom: "", validTo: "", comboPrice: "", discountPercentage: "", productIds: []
};

function fmtMoney(n: number) { return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(s: string | null) { if (!s) return "—"; try { return new Date(s).toLocaleDateString("es-AR"); } catch { return s; } }

export default function PromocionesPage() {
  const [promos, setPromos] = useState<PromotionDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [searchProd, setSearchProd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, prods] = await Promise.all([getPromotions(), getProducts()]);
      setPromos(p); setProducts(prods);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormErr(null); setSearchProd(""); setOpen(true); };
  const openEdit = (pr: PromotionDto) => {
    setEditing(pr);
    setForm({
      name: pr.name,
      description: pr.description ?? "",
      type: pr.type,
      isActive: pr.isActive,
      validFrom: pr.validFrom ? new Date(pr.validFrom).toISOString().slice(0, 10) : "",
      validTo: pr.validTo ? new Date(pr.validTo).toISOString().slice(0, 10) : "",
      comboPrice: pr.comboPrice != null ? String(pr.comboPrice) : "",
      discountPercentage: pr.discountPercentage != null ? String(pr.discountPercentage) : "",
      productIds: pr.products.map(x => x.id),
    });
    setFormErr(null); setSearchProd(""); setOpen(true);
  };

  const selectedProducts = useMemo(() => products.filter(p => form.productIds.includes(p.id)), [products, form.productIds]);
  const total = useMemo(() => selectedProducts.reduce((s, p) => s + p.price, 0), [selectedProducts]);
  const comboPriceNum = parseFloat(form.comboPrice) || 0;
  const discountNum = parseFloat(form.discountPercentage) || 0;
  const savingAmount = form.type === 0 ? (total - comboPriceNum) : (total * discountNum / 100);
  const savingPercent = form.type === 0 ? (total > 0 ? savingAmount / total * 100 : 0) : discountNum;
  const filteredProducts = useMemo(() => {
    const q = searchProd.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, searchProd]);

  const validate = (): string | null => {
    if (form.name.trim().length < 3) return "Nombre debe tener al menos 3 caracteres (máx 80)";
    if (form.name.trim().length > 80) return "Nombre máx 80";
    if (form.description && form.description.length > 500) return "Descripción máx 500";
    if (form.type === 0 && form.productIds.length < 2) return "Combo requiere al menos 2 productos";
    if (form.type === 1 && form.productIds.length < 1) return "Descuento requiere al menos 1 producto";
    if (form.type === 0) {
      const v = parseFloat(form.comboPrice);
      if (!v || v <= 0) return "Precio combo debe ser > 0";
    }
    if (form.type === 1) {
      const v = parseFloat(form.discountPercentage);
      if (!(v >= 1 && v <= 90)) return "Descuento debe estar entre 1 y 90%";
    }
    if (form.validFrom && form.validTo && form.validFrom > form.validTo) return "Hasta debe ser >= Desde";
    return null;
  };

  const handleSubmit = async () => {
    const v = validate();
    if (v) { setFormErr(v); return; }
    setSubmitting(true); setFormErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        isActive: form.isActive,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
        validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
        comboPrice: form.type === 0 ? parseFloat(form.comboPrice) : null,
        discountPercentage: form.type === 1 ? parseFloat(form.discountPercentage) : null,
        productIds: form.productIds,
      };
      if (editing) await updatePromotion(editing.id, payload);
      else await createPromotion(payload);
      setOpen(false); await load();
    } catch (e: unknown) { setFormErr(e instanceof Error ? e.message : String(e)); } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar promoción?")) return;
    await deletePromotion(id); await load();
  };
  const handleToggle = async (p: PromotionDto) => {
    await togglePromotion(p.id); await load();
  };

  const toggleProduct = (id: string) => {
    setForm(f => ({ ...f, productIds: f.productIds.includes(id) ? f.productIds.filter(x => x !== id) : [...f.productIds, id] }));
  };

  if (loading) return <div className="p-6">Cargando promos...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="size-6" /> Promos & Combos</h1>
          <p className="text-sm text-muted-foreground">Combos con precio fijo y descuentos % con vigencia. Solo activos y vigentes aparecen en Ventas.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><PackageCheck className="size-4" /> Nuevo combo/promo</Button>
      </div>
      {error && <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">{error}</div>}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Precio / Ahorro</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promos.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin promociones. Crea tu primer combo.</TableCell></TableRow>}
            {promos.map(pr => {
              const isExpired = pr.validTo && new Date(pr.validTo) < new Date(new Date().toISOString().slice(0,10));
              let estado: { label: string; variant: "default"|"secondary"|"destructive"|"outline" } = { label: "Inactiva", variant: "secondary" };
              if (pr.isCurrentlyActive) estado = { label: "Activa", variant: "default" };
              else if (!pr.isActive) estado = { label: "Inactiva", variant: "secondary" };
              else if (isExpired) estado = { label: "Vencida", variant: "destructive" };
              else estado = { label: "Fuera de vigencia", variant: "outline" };
              return (
                <TableRow key={pr.id}>
                  <TableCell>
                    <div className="font-medium">{pr.name}</div>
                    {pr.description && <div className="text-xs text-muted-foreground line-clamp-1">{pr.description}</div>}
                  </TableCell>
                  <TableCell>{pr.type === 0 ? <Badge className="bg-amber-500 text-white"><PackageCheck className="size-3 mr-1" /> Combo</Badge> : <Badge variant="secondary" className="gap-1"><BadgePercent className="size-3" /> Descuento</Badge>}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1 max-w-[260px]">{pr.products.map(p => <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>)}</div></TableCell>
                  <TableCell>
                    {pr.type === 0 ? (
                      <div className="text-sm"><div className="line-through text-muted-foreground">{fmtMoney(pr.totalOriginalPrice ?? 0)}</div><div className="font-semibold">{fmtMoney(pr.comboPrice ?? 0)}</div><div className="text-xs text-emerald-600">Ahorrás {fmtMoney(pr.savingAmount ?? 0)} ({(pr.savingPercent ?? 0).toFixed(1)}%)</div></div>
                    ) : (
                      <div className="text-sm"><div>{fmtMoney(pr.totalOriginalPrice ?? 0)} → <span className="font-semibold text-emerald-600">{fmtMoney((pr.totalOriginalPrice ?? 0) - (pr.savingAmount ?? 0))}</span></div><div className="text-xs"><Badge variant="destructive" className="text-xs">-{pr.discountPercentage}%</Badge> ahorrás {fmtMoney(pr.savingAmount ?? 0)}</div></div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(pr.validFrom)} — {fmtDate(pr.validTo)}</TableCell>
                  <TableCell><Badge variant={estado.variant}>{estado.label}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(pr)}><Pencil className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleToggle(pr)} title={pr.isActive ? "Desactivar" : "Activar"}>
                        <span className={`inline-block size-3 rounded-full ${pr.isActive ? "bg-emerald-500" : "bg-zinc-400"}`} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(pr.id)}><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-background rounded-xl border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg">{editing ? "Editar" : "Nuevo"} combo / promo</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="overflow-auto p-5 space-y-4">
              {formErr && <div className="bg-destructive/10 text-destructive p-2 rounded text-sm">{formErr}</div>}

              <div className="grid gap-3">
                <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Combo Desayuno / -20% Lacteos" maxLength={80} /><div className="text-xs text-muted-foreground text-right">{form.name.length}/80</div></div>
                <div><Label>Descripción</Label><textarea className="w-full rounded-md border p-2 text-sm min-h-[60px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={500} placeholder="Opcional" /><div className="text-xs text-muted-foreground text-right">{form.description.length}/500</div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: parseInt(e.target.value) as 0|1 })} className="w-full rounded-md border h-9 px-2 bg-background">
                      <option value={0}>Combo (precio fijo)</option>
                      <option value={1}>Porcentaje (%)</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="size-4" /> Activo</label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Desde</Label><Input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} /></div>
                  <div><Label>Hasta (inclusive)</Label><Input type="date" value={form.validTo} onChange={e => setForm({ ...form, validTo: e.target.value })} /></div>
                </div>
                {form.type === 0 ? (
                  <div><Label>Precio combo $ *</Label><Input type="number" min={0} step={0.01} value={form.comboPrice} onChange={e => setForm({ ...form, comboPrice: e.target.value })} placeholder="4500" />
                    {comboPriceNum > total && total>0 && <div className="text-xs text-amber-600 mt-1">⚠ Precio combo mayor a la suma ({fmtMoney(total)}) — no hay ahorro</div>}
                  </div>
                ) : (
                  <div><Label>Descuento % (1..90) *</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="range" min={1} max={90} value={discountNum || 10} onChange={e => setForm({ ...form, discountPercentage: e.target.value })} className="flex-1" />
                      <Input type="number" min={1} max={90} className="w-20" value={form.discountPercentage} onChange={e => setForm({ ...form, discountPercentage: e.target.value })} />
                      <span className="text-sm">%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Productos {form.type===0 ? "(mín 2)" : "(mín 1)"} — {selectedProducts.length} seleccionados</Label>
                <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar por nombre o SKU..." value={searchProd} onChange={e => setSearchProd(e.target.value)} /></div>
                <div className="border rounded-md max-h-48 overflow-auto divide-y">
                  {filteredProducts.map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="size-4" />
                      <span className="flex-1 text-sm">{p.name} <span className="text-muted-foreground text-xs">({p.sku})</span></span>
                      <span className="text-sm font-medium">{fmtMoney(p.price)}</span>
                      <span className={`text-xs ${p.stock>0?"text-emerald-600":"text-destructive"}`}>stock {p.stock}</span>
                    </label>
                  ))}
                  {filteredProducts.length===0 && <div className="p-3 text-sm text-muted-foreground text-center">Sin resultados</div>}
                </div>
              </div>

              {selectedProducts.length>0 && (
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-sm font-medium">Preview</div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">$ Precio</TableHead>{form.type===1 && <TableHead className="text-right">Con dto.</TableHead>}</TableRow></TableHeader>
                    <TableBody>
                      {selectedProducts.map(p => {
                        const discounted = form.type===1 ? p.price * (1 - discountNum/100) : p.price;
                        return <TableRow key={p.id}><TableCell className="text-sm">{p.name}</TableCell><TableCell className="text-right">{fmtMoney(p.price)}</TableCell>{form.type===1 && <TableCell className="text-right text-emerald-600">{fmtMoney(discounted)}</TableCell>}</TableRow>;
                      })}
                      <TableRow className="bg-muted/50 font-semibold"><TableCell>Suma</TableCell><TableCell className="text-right">{fmtMoney(total)}</TableCell>{form.type===1 && <TableCell className="text-right">{fmtMoney(total - savingAmount)}</TableCell>}</TableRow>
                    </TableBody>
                  </Table>
                  <div className="p-3 flex items-center justify-between bg-amber-50 dark:bg-amber-950/20 border-t">
                    <span className="text-sm">{form.type===0 ? `Combo ${fmtMoney(comboPriceNum || 0)}` : `Descuento ${discountNum}%`}</span>
                    <Badge className={savingAmount>0?"bg-emerald-600":"bg-zinc-500"}>Ahorrás {fmtMoney(savingAmount)} ({savingPercent.toFixed(1)}%)</Badge>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting?"Guardando...": editing?"Guardar":"Crear"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
