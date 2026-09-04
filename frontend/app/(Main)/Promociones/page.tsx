"use client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { getProducts, getPromotions, createPromotion, updatePromotion, deletePromotion, togglePromotion, uploadPromotionImage, API_URL, type ProductDto, type PromotionDto, type PromotionLineDto } from "@/lib/api";
import { Tag, BadgePercent, PackageCheck, Trash2, Pencil, Search, X, Plus, Minus } from "lucide-react";

type SelectedLine = { id: string; qty: number };

type FormState = {
  name: string;
  description: string;
  type: 0 | 1;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  comboPrice: string;
  discountPercentage: string;
  lines: SelectedLine[];
};

const emptyForm: FormState = {
  name: "", description: "", type: 0, isActive: true, validFrom: "", validTo: "", comboPrice: "", discountPercentage: "", lines: []
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
  const [promoImageUrl, setPromoImageUrl] = useState("");
  const [selectedPromoFile, setSelectedPromoFile] = useState<File | null>(null);
  const [promoPreviewUrl, setPromoPreviewUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, prods] = await Promise.all([getPromotions(), getProducts()]);
      setPromos(p); setProducts(prods);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormErr(null); setSearchProd(""); setPromoImageUrl(""); setSelectedPromoFile(null); if (promoPreviewUrl) URL.revokeObjectURL(promoPreviewUrl); setPromoPreviewUrl(null); setOpen(true); };
  const openEdit = (pr: PromotionDto) => {
    setEditing(pr);
    const lines: SelectedLine[] = pr.lines?.length ? pr.lines.map(l => ({ id: l.productId, qty: l.quantity })) : pr.products.map(x => ({ id: x.id, qty: 1 }));
    setForm({
      name: pr.name,
      description: pr.description ?? "",
      type: pr.type,
      isActive: pr.isActive,
      validFrom: pr.validFrom ? new Date(pr.validFrom).toISOString().slice(0, 10) : "",
      validTo: pr.validTo ? new Date(pr.validTo).toISOString().slice(0, 10) : "",
      comboPrice: pr.comboPrice != null ? String(pr.comboPrice) : "",
      discountPercentage: pr.discountPercentage != null ? String(pr.discountPercentage) : "",
      lines,
    });
    setFormErr(null); setSearchProd(""); setPromoImageUrl(pr.imageUrl ?? ""); setSelectedPromoFile(null); if (promoPreviewUrl) URL.revokeObjectURL(promoPreviewUrl); setPromoPreviewUrl(null); setOpen(true);
  };

  const selectedLines = useMemo(() => {
    return form.lines.map(l => {
      const prod = products.find(p => p.id === l.id);
      return { ...l, product: prod };
    });
  }, [form.lines, products]);
  const total = useMemo(() => selectedLines.reduce((s, l) => s + (l.product?.price ?? 0) * l.qty, 0), [selectedLines]);
  const totalUnits = useMemo(() => selectedLines.reduce((s, l) => s + l.qty, 0), [selectedLines]);
  const comboPriceNum = parseFloat(form.comboPrice) || 0;
  const discountNum = parseFloat(form.discountPercentage) || 0;
  const hasComboPrice = form.comboPrice.trim() !== "" && !isNaN(comboPriceNum) && comboPriceNum > 0;
  const hasDiscount = form.discountPercentage.trim() !== "" && !isNaN(discountNum) && discountNum > 0;
  const filteredProducts = useMemo(() => {
    const q = searchProd.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, searchProd]);

  const validate = (): string | null => {
    if (form.name.trim().length < 3) return "Nombre debe tener al menos 3 caracteres (máx 80)";
    if (form.name.trim().length > 80) return "Nombre máx 80";
    if (form.description && form.description.length > 500) return "Descripción máx 500";
    if (form.type === 0) {
      if (totalUnits < 2) return "Combo requiere al menos 2 unidades (suma cantidades >=2) —ej: Gaseosa Seven Up x3 para 3x2";
      if (form.lines.some(l => l.qty < 1 || l.qty > 99)) return "Cantidad 1..99";
    }
    if (form.type === 1 && form.lines.length < 1) return "Descuento requiere al menos 1 producto";
    if (form.type === 1 && form.lines.some(l => l.qty < 1 || l.qty > 99)) return "Cantidad 1..99";
    if (form.type === 0) {
      const v = parseFloat(form.comboPrice);
      if (!v || v <= 0) return "Precio combo debe ser > 0";
    }
    if (form.type === 1) {
      const v = parseFloat(form.discountPercentage);
      if (!(v >= 1 && v <= 90)) return "Descuento debe estar entre 1 y 90%";
    }
    if (form.validFrom && form.validTo && form.validFrom > form.validTo) return "Hasta debe ser >= Desde";
    if (form.lines.length === 0) return "Debe incluir al menos 1 producto";
    return null;
  };

  const handleSubmit = async () => {
    const v = validate();
    if (v) { setFormErr(v); return; }
    setSubmitting(true); setFormErr(null);
    try {
      const plines = form.lines.map(l => ({ productId: l.id, quantity: form.type === 1 ? 1 : l.qty } as PromotionLineDto));
      const payload: Parameters<typeof createPromotion>[0] = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        isActive: form.isActive,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
        validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
        comboPrice: form.type === 0 ? parseFloat(form.comboPrice) : null,
        discountPercentage: form.type === 1 ? parseFloat(form.discountPercentage) : null,
        lines: plines,
        imageUrl: selectedPromoFile ? null : (promoImageUrl.trim() || null),
      };
      let promoId: string | null = null;
      if (editing) {
        await updatePromotion(editing.id, payload);
        promoId = editing.id;
      } else {
        const created = await createPromotion(payload);
        promoId = created.id;
      }
      if (selectedPromoFile && promoId) {
        try {
          await uploadPromotionImage(promoId, selectedPromoFile);
        } catch (upErr) {
          setFormErr(`Promo guardada, pero falló subir imagen: ${upErr instanceof Error ? upErr.message : String(upErr)}`);
        }
      }
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

  const addProduct = (id: string) => {
    setForm(f => {
      if (f.lines.find(l => l.id === id)) return f;
      // Para % qty 1 fijo, para combo default 1
      return { ...f, lines: [...f.lines, { id, qty: 1 }] };
    });
  };
  const updateQty = (id: string, delta: number) => {
    setForm(f => ({
      ...f,
      lines: f.lines.map(l => {
        if (l.id !== id) return l;
        const next = Math.min(99, Math.max(1, l.qty + delta));
        // Para % no aplica 3x2, deja qty 1 fijo
        if (f.type === 1 && next !== 1) return { ...l, qty: 1 };
        return { ...l, qty: next };
      })
    }));
  };
  const setQty = (id: string, qty: number) => {
    const clamped = Math.min(99, Math.max(1, Math.floor(qty) || 1));
    setForm(f => ({
      ...f,
      lines: f.lines.map(l => l.id === id ? { ...l, qty: f.type === 1 ? 1 : clamped } : l)
    }));
  };
  const removeLine = (id: string) => setForm(f => ({ ...f, lines: f.lines.filter(l => l.id !== id) }));

  const toggleProduct = (id: string) => {
    if (form.lines.find(l => l.id === id)) removeLine(id);
    else addProduct(id);
  };

  if (loading) return <div className="p-6">Cargando promos...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Tag className="size-6" /> Promos & Combos</h1>
          <p className="text-sm text-muted-foreground">Combos con precio fijo y descuentos % con vigencia. Soporta 3x2 mismo producto via cantidad. Solo activos y vigentes aparecen en Ventas.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><PackageCheck className="size-4" /> Nuevo combo/promo</Button>
      </div>
      {error && <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">{error}</div>}

      <div className="rounded-md border bg-card">
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
              const displayProducts = pr.lines?.length ? pr.lines : pr.products.map(p => ({ productId: p.id, productName: p.name, sku: p.sku, unitPrice: p.price, quantity: 1, lineTotal: p.price }));
              return (
                <TableRow key={pr.id}>
                  <TableCell>
                    <div className="font-medium">{pr.name}</div>
                    {pr.description && <div className="text-xs text-muted-foreground line-clamp-1">{pr.description}</div>}
                  </TableCell>
                  <TableCell>{pr.type === 0 ? <Badge className="bg-amber-500 text-white"><PackageCheck className="size-3 mr-1" /> Combo</Badge> : <Badge variant="secondary" className="gap-1"><BadgePercent className="size-3" /> Descuento</Badge>}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1 max-w-[260px]">{displayProducts.map((p, idx) => <Badge key={p.productId+idx} variant="outline" className="text-xs">{p.productName} ×{p.quantity}</Badge>)}</div></TableCell>
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
                        <span className={`inline-block size-3 rounded-md ${pr.isActive ? "bg-emerald-500" : "bg-zinc-400"}`} />
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
          <div className="bg-background rounded-xl border w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-lg">{editing ? "Editar" : "Nuevo"} combo / promo {form.type===0 && <span className="text-xs font-normal text-muted-foreground ml-2">3x2: mismo producto con cantidad &gt;1</span>}</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="overflow-auto p-5 space-y-6 max-h-[85vh]">
              {formErr && <div className="bg-destructive/10 text-destructive p-2 rounded text-sm">{formErr}</div>}

              {/* Paso 1 – Tipo (compacto, arriba) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">1</span>
                  <span className="font-semibold text-sm">Tipo</span>
                  <span className="text-xs text-muted-foreground">Elegí el tipo antes de armar el combo</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer text-sm ${form.type===0 ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                    <input type="radio" name="promo-type" checked={form.type===0} onChange={() => setForm(f => ({ ...f, type: 0, discountPercentage: "" }))} className="size-4" />
                    <PackageCheck className="size-4" /> Combo (precio fijo bundle)
                  </label>
                  <label className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer text-sm ${form.type===1 ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                    <input type="radio" name="promo-type" checked={form.type===1} onChange={() => setForm(f => ({ ...f, type: 1, comboPrice: "", lines: f.lines.map(l => ({ ...l, qty: 1 })) }))} className="size-4" />
                    <BadgePercent className="size-4" /> Promoción % (descuento)
                  </label>
                </div>
                {form.type===0 && <p className="text-xs text-muted-foreground">Combo permite mismo producto con cantidad &gt;1 (ej: 3×2).</p>}
                {form.type===1 && <p className="text-xs text-muted-foreground">Descuento %: cantidad siempre 1 por producto.</p>}
              </div>

              {/* Paso 2 – Selección productos */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">2</span>
                  <span className="font-semibold text-sm">Productos</span>
                  <span className="text-xs text-muted-foreground">{form.type===0 ? `(mín 2 unidades — ${totalUnits} actual)` : "(mín 1)"} — {selectedLines.length} líneas</span>
                </div>
                <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar por nombre o SKU..." value={searchProd} onChange={e => setSearchProd(e.target.value)} /></div>
                <div className="border rounded-md max-h-48 overflow-auto divide-y">
                  {filteredProducts.map(p => {
                    const isSelected = form.lines.some(l => l.id === p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleProduct(p.id)} className="size-4" />
                        <span className="flex-1 text-sm">{p.name} <span className="text-muted-foreground text-xs">({p.sku})</span></span>
                        <span className="text-sm font-medium">{fmtMoney(p.price)}</span>
                        <span className={`text-xs ${p.stock>0?"text-emerald-600":"text-destructive"}`}>stock {p.stock}</span>
                      </label>
                    );
                  })}
                  {filteredProducts.length===0 && <div className="p-3 text-sm text-muted-foreground text-center">Sin resultados</div>}
                </div>

                {selectedLines.length>0 && (
                  <div className="border rounded-md overflow-hidden">
                    <div className="bg-muted px-3 py-2 text-sm font-medium">Productos elegidos — cantidad por línea {form.type===0 ? "(3×2: subí a ×3)" : ""}</div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">$ Unitario</TableHead><TableHead className="text-center">Cantidad</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {selectedLines.map(l => {
                          if (!l.product) return null;
                          const subtotal = l.product.price * l.qty;
                          const isPercent = form.type===1;
                          return (
                            <TableRow key={l.id}>
                              <TableCell className="text-sm">{l.product.name} <span className="text-xs text-muted-foreground">({l.product.sku})</span></TableCell>
                              <TableCell className="text-right">{fmtMoney(l.product.price)}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="icon" variant="outline" className="size-7" onClick={() => updateQty(l.id, -1)} disabled={isPercent}><Minus className="size-3" /></Button>
                                  {isPercent ? (
                                    <span className="w-12 text-center text-sm">1</span>
                                  ) : (
                                    <Input type="number" min={1} max={99} value={l.qty} onChange={e => setQty(l.id, parseInt(e.target.value))} className="w-14 h-7 text-center" />
                                  )}
                                  <Button size="icon" variant="outline" className="size-7" onClick={() => updateQty(l.id, 1)} disabled={isPercent}><Plus className="size-3" /></Button>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{fmtMoney(subtotal)}</TableCell>
                              <TableCell><Button size="icon" variant="ghost" onClick={() => removeLine(l.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/50 font-semibold"><TableCell>Total</TableCell><TableCell></TableCell><TableCell className="text-center">{totalUnits} u.</TableCell><TableCell className="text-right">{fmtMoney(total)}</TableCell><TableCell></TableCell></TableRow>
                      </TableBody>
                    </Table>
                    {form.type===0 && totalUnits>=2 && <p className="px-3 py-2 text-xs text-muted-foreground border-t">Ejemplo 3×2: seleccioná 1 producto y subí cantidad a ×3, poné precio combo = precio de 2.</p>}
                    {form.type===0 && total===0 && <p className="px-3 py-2 text-xs text-muted-foreground border-t">Agregá productos con cantidad para ver total original.</p>}
                  </div>
                )}
                {selectedLines.length===0 && <p className="text-xs text-muted-foreground">Elegí productos para ver el total Σ (precio × qty) destacado arriba del detalle del combo.</p>}
              </div>

              {/* Paso 3 – Detalles del combo/promo (debajo del total, no arriba) */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">3</span>
                  <span className="font-semibold text-sm">Detalles del {form.type===0 ? "combo" : "descuento"}</span>
                </div>

                <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Combo verano 3x2" maxLength={80} /><div className="text-xs text-muted-foreground text-right">{form.name.length}/80</div></div>
                <div className="space-y-2">
                  <Label>Imagen del combo/promo</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="url" placeholder="https://..." value={promoImageUrl} onChange={e => setPromoImageUrl(e.target.value)} className="flex-1" />
                    {promoImageUrl.trim() && !selectedPromoFile && (
                      <img src={promoImageUrl.trim().startsWith("/") ? `${API_URL}${promoImageUrl.trim()}` : promoImageUrl.trim()} alt="preview url" className="h-10 w-10 object-cover rounded border" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">o Subir archivo</Label>
                    <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setSelectedPromoFile(f); if (promoPreviewUrl) URL.revokeObjectURL(promoPreviewUrl); if (f) setPromoPreviewUrl(URL.createObjectURL(f)); else setPromoPreviewUrl(null); }} />
                    {selectedPromoFile && promoPreviewUrl && (
                      <div className="flex items-center gap-2 mt-1">
                        <img src={promoPreviewUrl} alt="preview file" className="h-12 w-12 object-cover rounded border" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedPromoFile(null); if (promoPreviewUrl) URL.revokeObjectURL(promoPreviewUrl); setPromoPreviewUrl(null); }}>
                          Quitar
                        </Button>
                        <span className="text-xs text-muted-foreground truncate">{selectedPromoFile.name}</span>
                      </div>
                    )}
                    {selectedPromoFile && promoImageUrl.trim() && <p className="text-xs text-amber-600">Se priorizará el archivo sobre la URL.</p>}
                  </div>
                </div>
                <div><Label>Descripción</Label><textarea className="w-full rounded-md border p-2 text-sm min-h-[60px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={500} placeholder="Opcional — ej: Gaseosa Seven Up x3 a precio de 2" /><div className="text-xs text-muted-foreground text-right">{form.description.length}/500</div></div>

                {form.type===0 ? (
                  <div className="space-y-2">
                    <Label>Precio del combo *</Label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input type="number" min={0} step={0.01} className="pl-7" value={form.comboPrice} onChange={e => setForm({ ...form, comboPrice: e.target.value })} placeholder="5500" />
                      </div>
                      <div className="sm:min-w-[280px] flex justify-start sm:justify-end">
                        {!hasComboPrice || total===0 ? (
                          <span className="text-sm text-muted-foreground italic">Definí el precio del combo para ver el ahorro —</span>
                        ) : comboPriceNum >= total ? (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-600 whitespace-normal text-center">Sin ahorro — el combo cuesta igual o más que la suma ({fmtMoney(total)})</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700">Ahorrás {fmtMoney(total - comboPriceNum)} ({((total - comboPriceNum)/total*100).toFixed(1)}%)</Badge>
                        )}
                      </div>
                    </div>
                    {hasComboPrice && comboPriceNum > 0 && total>0 && comboPriceNum > total && <div className="text-xs text-amber-600">⚠ Precio combo mayor a la suma — no hay ahorro</div>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Descuento % * (1..90)</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="range" min={1} max={90} value={discountNum || 10} onChange={e => setForm({ ...form, discountPercentage: e.target.value })} className="flex-1" />
                      <Input type="number" min={1} max={90} className="w-20" value={form.discountPercentage} onChange={e => setForm({ ...form, discountPercentage: e.target.value })} />
                      <span className="text-sm">%</span>
                    </div>
                    <div className="flex justify-end">
                      {!hasDiscount ? (
                        <span className="text-sm text-muted-foreground italic">Elegí % para ver ahorro</span>
                      ) : total===0 ? (
                        <span className="text-sm text-muted-foreground italic">Agregá productos para ver ahorro</span>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700">Ahorrás {fmtMoney(total * discountNum / 100)} ({discountNum.toFixed(1)}%)</Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Desde</Label><Input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} /></div>
                  <div><Label>Hasta (inclusive)</Label><Input type="date" value={form.validTo} onChange={e => setForm({ ...form, validTo: e.target.value })} /></div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="size-4" /> Activo</label>
              </div>
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


