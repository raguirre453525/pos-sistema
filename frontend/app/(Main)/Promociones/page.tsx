"use client";
import { useState, useEffect, useMemo } from "react";
import { useFeatureGuard } from "@/hooks/useFeatureGuard";
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

function getPromotionStatus(promo: PromotionDto) {
  const isExpired = promo.validTo && new Date(promo.validTo) < new Date(new Date().toISOString().slice(0, 10));
  if (promo.isCurrentlyActive) return { label: "Activa", variant: "default" as const };
  if (!promo.isActive) return { label: "Inactiva", variant: "secondary" as const };
  if (isExpired) {
    return { label: "Vencida", variant: "destructive" as const };
  }
  return { label: "Fuera de vigencia", variant: "outline" as const };
}

export default function PromocionesPage() {
  const { allowed } = useFeatureGuard({ requirePromos: true, denyRoles: ["SuperAdmin"], redirectTo: "/Admin/Negocios" });
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

  const load = () => Promise.resolve()
    .then(() => setLoading(true))
    .then(() => Promise.all([getPromotions(), getProducts()]))
    .then(([p, prods]) => { setPromos(p); setProducts(prods); })
    .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
    .finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

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

  if (!allowed) {
    return (
      <div className="w-full min-w-0 p-4 flex flex-col gap-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Redirigiendo…</p>
      </div>
    );
  }

  if (loading) {
    return <div className="min-w-0 p-6">Cargando promos...</div>;
  }

  return (
    <div className="w-full min-w-0 max-w-none space-y-4 overflow-x-clip p-4 md:p-6">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl"><Tag className="size-5 shrink-0 sm:size-6" /> Promos & Combos</h1>
        </div>
        <Button type="button" onClick={openCreate} className="min-h-11 w-full gap-2 sm:w-auto"><PackageCheck className="size-4" /> Nuevo combo/promo</Button>
      </header>

      {error && <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="hidden overflow-hidden rounded-lg border bg-card xl:block">
        <Table className="min-w-[920px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[16%]">Nombre</TableHead>
              <TableHead className="w-[12%]">Tipo</TableHead>
              <TableHead className="w-[19%]">Productos</TableHead>
              <TableHead className="w-[16%]">Precio / Ahorro</TableHead>
              <TableHead className="w-[13%]">Vigencia</TableHead>
              <TableHead className="w-[9%]">Estado</TableHead>
              <TableHead className="w-[15%] min-w-[144px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin promociones. Crea tu primer combo.</TableCell>
              </TableRow>
            )}
            {promos.map(promo => {
              const status = getPromotionStatus(promo);
              const displayProducts = promo.lines?.length
                ? promo.lines
                : (promo.products ?? []).map(product => ({ productId: product.id, productName: product.name, sku: product.sku, unitPrice: product.price, quantity: 1, lineTotal: product.price }));
              return (
                <TableRow key={promo.id}>
                  <TableCell className="break-words">
                    <div className="font-medium">{promo.name}</div>
                    {promo.description && <div className="line-clamp-2 text-xs text-muted-foreground">{promo.description}</div>}
                  </TableCell>
                  <TableCell>{promo.type === 0 ? <Badge className="bg-amber-500 text-white"><PackageCheck aria-hidden="true" className="mr-1 size-3" /> Combo</Badge> : <Badge variant="secondary" className="gap-1"><BadgePercent aria-hidden="true" className="size-3" /> Descuento</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex max-h-16 max-w-full flex-wrap gap-1 overflow-y-auto pr-1">
                      {displayProducts.map((product, index) => <Badge key={`${product.productId}${index}`} variant="outline" className="max-w-full whitespace-normal break-words text-xs">{product.productName} ×{product.quantity}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {promo.type === 0 ? (
                      <div className="text-sm"><div className="line-through text-muted-foreground">{fmtMoney(promo.totalOriginalPrice ?? 0)}</div><div className="font-semibold">{fmtMoney(promo.comboPrice ?? 0)}</div><div className="text-xs text-emerald-600">Ahorrás {fmtMoney(promo.savingAmount ?? 0)} ({(promo.savingPercent ?? 0).toFixed(1)}%)</div></div>
                    ) : (
                      <div className="text-sm"><div>{fmtMoney(promo.totalOriginalPrice ?? 0)} → <span className="font-semibold text-emerald-600">{fmtMoney((promo.totalOriginalPrice ?? 0) - (promo.savingAmount ?? 0))}</span></div><div className="text-xs"><Badge variant="destructive" className="text-xs">-{promo.discountPercentage}%</Badge> ahorrás {fmtMoney(promo.savingAmount ?? 0)}</div></div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">{fmtDate(promo.validFrom)} — {fmtDate(promo.validTo)}</TableCell>
                  <TableCell><Badge variant={status.variant} className="whitespace-normal">{status.label}</Badge></TableCell>
                  <TableCell className="min-w-[144px] text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="icon" variant="ghost" className="min-h-10 min-w-10" aria-label={`Editar ${promo.name}`} onClick={() => openEdit(promo)}><Pencil aria-hidden="true" className="size-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="min-h-10 min-w-10" aria-label={`${promo.isActive ? "Desactivar" : "Activar"} ${promo.name}`} aria-pressed={promo.isActive} onClick={() => handleToggle(promo)}>
                        <span aria-hidden="true" className={`inline-block size-3 rounded-md ${promo.isActive ? "bg-emerald-500" : "bg-zinc-400"}`} />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="min-h-10 min-w-10" aria-label={`Eliminar ${promo.name}`} onClick={() => handleDelete(promo.id)}><Trash2 aria-hidden="true" className="size-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:hidden">
        {promos.map(promo => {
          const status = getPromotionStatus(promo);
          const displayProducts = promo.lines?.length
            ? promo.lines
            : (promo.products ?? []).map(product => ({ productId: product.id, productName: product.name, sku: product.sku, unitPrice: product.price, quantity: 1, lineTotal: product.price }));
          return (
            <article key={promo.id} className="min-w-0 rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {promo.type === 0 ? <Badge className="bg-amber-500 text-white"><PackageCheck aria-hidden="true" className="mr-1 size-3" /> Combo</Badge> : <Badge variant="secondary" className="gap-1"><BadgePercent aria-hidden="true" className="size-3" /> Descuento</Badge>}
                <Badge variant={status.variant} className="whitespace-normal">{status.label}</Badge>
              </div>
              <div className="mt-3 min-w-0">
                <h2 className="break-words font-semibold">{promo.name}</h2>
                {promo.description && <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{promo.description}</p>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Precio / Ahorro</p>
                  {promo.type === 0 ? (
                    <>
                      <p className="line-through text-xs text-muted-foreground">{fmtMoney(promo.totalOriginalPrice ?? 0)}</p>
                      <p className="font-semibold">{fmtMoney(promo.comboPrice ?? 0)}</p>
                      <p className="mt-1 text-xs text-emerald-600">Ahorrás {fmtMoney(promo.savingAmount ?? 0)} ({(promo.savingPercent ?? 0).toFixed(1)}%)</p>
                    </>
                  ) : (
                    <>
                      <p>{fmtMoney(promo.totalOriginalPrice ?? 0)} → <span className="font-semibold text-emerald-600">{fmtMoney((promo.totalOriginalPrice ?? 0) - (promo.savingAmount ?? 0))}</span></p>
                      <div className="mt-1 text-xs"><Badge variant="destructive" className="text-xs">-{promo.discountPercentage}%</Badge> ahorrás {fmtMoney(promo.savingAmount ?? 0)}</div>
                    </>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Vigencia</p>
                  <p className="break-words">{fmtDate(promo.validFrom)} — {fmtDate(promo.validTo)}</p>
                </div>
              </div>
              <div className="mt-4 min-w-0">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Productos</p>
                <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
                  {displayProducts.map((product, index) => <Badge key={`${product.productId}${index}`} variant="outline" className="max-w-full whitespace-normal break-words text-xs">{product.productName} ×{product.quantity}</Badge>)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
                <Button type="button" variant="outline" className="min-h-11 min-w-0 gap-1 px-2 text-xs" aria-label={`Editar ${promo.name}`} onClick={() => openEdit(promo)}><Pencil aria-hidden="true" className="size-3.5" /> Editar</Button>
                <Button type="button" variant="outline" className="min-h-11 min-w-0 gap-1 px-1 text-xs" aria-label={`${promo.isActive ? "Desactivar" : "Activar"} ${promo.name}`} aria-pressed={promo.isActive} onClick={() => handleToggle(promo)}><span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-md ${promo.isActive ? "bg-emerald-500" : "bg-zinc-400"}`} /> {promo.isActive ? "Desactivar" : "Activar"}</Button>
                <Button type="button" variant="outline" className="min-h-11 min-w-0 gap-1 px-2 text-xs text-destructive hover:text-destructive" aria-label={`Eliminar ${promo.name}`} onClick={() => handleDelete(promo.id)}><Trash2 aria-hidden="true" className="size-3.5" /> Eliminar</Button>
              </div>
            </article>
          );
        })}
      </div>

      {promos.length === 0 && (
        <div className="rounded-lg border bg-card px-4 py-10 text-center xl:hidden" role="status">
          <p className="text-sm text-muted-foreground">Sin promociones. Crea tu primer combo.</p>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="promotion-dialog-title" className="flex h-full max-h-dvh min-h-0 w-full max-w-3xl flex-col overflow-hidden border bg-background shadow-xl sm:h-auto sm:max-h-[85dvh] sm:rounded-xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b p-4 sm:items-center sm:p-5">
              <div className="min-w-0">
                <h2 id="promotion-dialog-title" className="font-semibold sm:text-lg">{editing ? "Editar" : "Nuevo"} combo / promo</h2>
                {form.type === 0 && <p className="mt-1 text-xs text-muted-foreground">3x2: mismo producto con cantidad &gt;1</p>}
              </div>
              <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label="Cerrar diálogo" onClick={() => setOpen(false)} disabled={submitting}><X aria-hidden="true" className="size-4" /></Button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {formErr && <div role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{formErr}</div>}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">1</span>
                  <span className="font-semibold text-sm">Tipo</span>
                  <span className="text-xs text-muted-foreground">Elegí el tipo antes de armar el combo</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${form.type === 0 ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                    <input type="radio" name="promo-type" checked={form.type === 0} onChange={() => setForm(f => ({ ...f, type: 0, discountPercentage: "" }))} className="size-4 shrink-0" />
                    <PackageCheck aria-hidden="true" className="size-4 shrink-0" /> <span>Combo (precio fijo bundle)</span>
                  </label>
                  <label className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${form.type === 1 ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                    <input type="radio" name="promo-type" checked={form.type === 1} onChange={() => setForm(f => ({ ...f, type: 1, comboPrice: "", lines: f.lines.map(l => ({ ...l, qty: 1 })) }))} className="size-4 shrink-0" />
                    <BadgePercent aria-hidden="true" className="size-4 shrink-0" /> <span>Promoción % (descuento)</span>
                  </label>
                </div>
                {form.type === 0 && <p className="text-xs text-muted-foreground">Combo permite mismo producto con cantidad &gt;1 (ej: 3x2).</p>}
                {form.type === 1 && <p className="text-xs text-muted-foreground">Descuento %: cantidad siempre 1 por producto.</p>}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">2</span>
                  <span className="font-semibold text-sm">Productos</span>
                  <span className="text-xs text-muted-foreground">{form.type === 0 ? `(mín 2 unidades — ${totalUnits} actual)` : "(mín 1)"} — {selectedLines.length} líneas</span>
                </div>
                <div className="relative min-w-0"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar productos por nombre o SKU" className="h-11 pl-9" placeholder="Buscar por nombre o SKU..." value={searchProd} onChange={event => setSearchProd(event.target.value)} /></div>
                <div className="max-h-52 divide-y overflow-y-auto overscroll-contain rounded-md border">
                  {filteredProducts.map(p => {
                    const isSelected = form.lines.some(l => l.id === p.id);
                    return (
                      <label key={p.id} className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 hover:bg-muted/50">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleProduct(p.id)} className="size-4" />
                        <span className="min-w-0 text-sm"><span className="block break-words">{p.name}</span><span className="block truncate text-xs text-muted-foreground">{p.sku}</span></span>
                        <span className="text-right"><span className="block whitespace-nowrap text-sm font-medium">{fmtMoney(p.price)}</span><span className={`block text-xs ${p.stock > 0 ? "text-emerald-600" : "text-destructive"}`}>stock {p.stock}</span></span>
                      </label>
                    );
                  })}
                  {filteredProducts.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Sin resultados</div>}
                </div>

                {selectedLines.length > 0 && (
                  <div className="overflow-hidden rounded-md border">
                    <div className="bg-muted px-3 py-2 text-sm font-medium">Productos elegidos — cantidad por línea {form.type === 0 ? "(3×2: subí a ×3)" : ""}</div>
                    <div className="space-y-2 p-2 sm:hidden">
                      {selectedLines.map(line => {
                        if (!line.product) return null;
                        const subtotal = line.product.price * line.qty;
                        const isPercent = form.type === 1;
                        return (
                          <div key={line.id} className="min-w-0 rounded-md border bg-card p-3">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0"><p className="break-words text-sm font-medium">{line.product.name}</p><p className="text-xs text-muted-foreground">{line.product.sku} · {fmtMoney(line.product.price)} c/u</p></div>
                              <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11 shrink-0" aria-label={`Quitar ${line.product.name}`} onClick={() => removeLine(line.id)}><Trash2 aria-hidden="true" className="size-4 text-destructive" /></Button>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-1">
                                <Button type="button" size="icon" variant="outline" className="min-h-11 min-w-11" aria-label={`Reducir cantidad de ${line.product.name}`} onClick={() => updateQty(line.id, -1)} disabled={isPercent}><Minus aria-hidden="true" className="size-3.5" /></Button>
                                {isPercent ? <span className="min-w-10 text-center text-sm">1</span> : <Input aria-label={`Cantidad de ${line.product.name}`} type="number" min={1} max={99} value={line.qty} onChange={event => setQty(line.id, parseInt(event.target.value))} className="h-11 w-16 text-center" />}
                                <Button type="button" size="icon" variant="outline" className="min-h-11 min-w-11" aria-label={`Aumentar cantidad de ${line.product.name}`} onClick={() => updateQty(line.id, 1)} disabled={isPercent}><Plus aria-hidden="true" className="size-3.5" /></Button>
                              </div>
                              <div className="text-right"><p className="text-xs text-muted-foreground">Subtotal</p><p className="text-sm font-semibold">{fmtMoney(subtotal)}</p></div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between px-1 pt-1 text-sm font-semibold"><span>Total · {totalUnits} u.</span><span>{fmtMoney(total)}</span></div>
                    </div>
                    <div className="hidden sm:block">
                      <Table className="min-w-[620px]">
                        <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">$ Unitario</TableHead><TableHead className="text-center">Cantidad</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead aria-label="Acciones" /></TableRow></TableHeader>
                        <TableBody>
                          {selectedLines.map(line => {
                            if (!line.product) return null;
                            const subtotal = line.product.price * line.qty;
                            const isPercent = form.type === 1;
                            return (
                              <TableRow key={line.id}>
                                <TableCell className="text-sm">{line.product.name} <span className="text-xs text-muted-foreground">({line.product.sku})</span></TableCell>
                                <TableCell className="text-right">{fmtMoney(line.product.price)}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button type="button" size="icon" variant="outline" className="size-8" aria-label={`Reducir cantidad de ${line.product.name}`} onClick={() => updateQty(line.id, -1)} disabled={isPercent}><Minus aria-hidden="true" className="size-3" /></Button>
                                    {isPercent ? <span className="w-12 text-center text-sm">1</span> : <Input aria-label={`Cantidad de ${line.product.name}`} type="number" min={1} max={99} value={line.qty} onChange={event => setQty(line.id, parseInt(event.target.value))} className="h-8 w-14 text-center" />}
                                    <Button type="button" size="icon" variant="outline" className="size-8" aria-label={`Aumentar cantidad de ${line.product.name}`} onClick={() => updateQty(line.id, 1)} disabled={isPercent}><Plus aria-hidden="true" className="size-3" /></Button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{fmtMoney(subtotal)}</TableCell>
                                <TableCell><Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`Quitar ${line.product.name}`} onClick={() => removeLine(line.id)}><Trash2 aria-hidden="true" className="size-4 text-destructive" /></Button></TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/50 font-semibold"><TableCell>Total</TableCell><TableCell /><TableCell className="text-center">{totalUnits} u.</TableCell><TableCell className="text-right">{fmtMoney(total)}</TableCell><TableCell /></TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    {form.type === 0 && totalUnits >= 2 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Ejemplo 3×2: seleccioná 1 producto, subí la cantidad a 3 y definí el precio del combo.</p>}
                    {form.type === 0 && total === 0 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Agregá productos para ver el total original.</p>}
                  </div>
                )}
                {selectedLines.length === 0 && <p className="text-xs text-muted-foreground">Elegí productos para ver el total Σ (precio × qty) destacado arriba del detalle del combo.</p>}
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">3</span>
                  <span className="font-semibold text-sm">Detalles del {form.type === 0 ? "combo" : "descuento"}</span>
                </div>

                <div><Label htmlFor="promo-name" className="mb-2">Nombre *</Label><Input id="promo-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ej: Combo verano 3x2" maxLength={80} className="h-11" /><div className="text-right text-xs text-muted-foreground">{form.name.length}/80</div></div>
                <div className="space-y-2">
                  <Label htmlFor="promo-image-url">Imagen del combo/promo</Label>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <Input id="promo-image-url" type="url" placeholder="https://..." value={promoImageUrl} onChange={event => setPromoImageUrl(event.target.value)} className="h-11 min-w-0 flex-1" />
                    {promoImageUrl.trim() && !selectedPromoFile && (
                      <img src={promoImageUrl.trim().startsWith("/") ? `${API_URL}${promoImageUrl.trim()}` : promoImageUrl.trim()} alt="Vista previa de la imagen" className="h-12 w-12 rounded border object-cover" onError={event => ((event.target as HTMLImageElement).style.display = "none")} />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="promo-image-file" className="text-xs">o Subir archivo</Label>
                    <Input id="promo-image-file" type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0] ?? null; setSelectedPromoFile(file); if (promoPreviewUrl) URL.revokeObjectURL(promoPreviewUrl); if (file) setPromoPreviewUrl(URL.createObjectURL(file)); else setPromoPreviewUrl(null); }} className="h-11 min-w-0 text-xs file:mr-2 file:max-w-[55%] file:truncate file:text-xs" />
                    {selectedPromoFile && promoPreviewUrl && (
                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        <img src={promoPreviewUrl} alt="Vista previa del archivo" className="h-12 w-12 shrink-0 rounded border object-cover" />
                        <Button type="button" variant="ghost" className="min-h-11 shrink-0" onClick={() => { setSelectedPromoFile(null); if (promoPreviewUrl) URL.revokeObjectURL(promoPreviewUrl); setPromoPreviewUrl(null); }}>Quitar</Button>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">{selectedPromoFile.name}</span>
                      </div>
                    )}
                    {selectedPromoFile && promoImageUrl.trim() && <p className="text-xs text-amber-600">Se priorizará el archivo sobre la URL.</p>}
                  </div>
                </div>
                <div><Label htmlFor="promo-description" className="mb-2">Descripción</Label><textarea id="promo-description" className="min-h-[88px] w-full resize-y rounded-md border border-input bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-[60px]" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={500} placeholder="Opcional — ej: Gaseosa Seven Up x3 a precio de 2" /><div className="text-right text-xs text-muted-foreground">{form.description.length}/500</div></div>

                {form.type === 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="promo-combo-price">Precio del combo *</Label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input id="promo-combo-price" type="number" min={0} step={0.01} className="h-11 pl-7" value={form.comboPrice} onChange={event => setForm({ ...form, comboPrice: event.target.value })} placeholder="5500" />
                      </div>
                      <div className="flex justify-start sm:min-w-[280px] sm:justify-end">
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
                    <Label htmlFor="promo-discount">Descuento % * (1..90)</Label>
                    <div className="flex min-w-0 items-center gap-2">
                      <Input aria-label="Porcentaje de descuento" type="range" min={1} max={90} value={discountNum || 10} onChange={event => setForm({ ...form, discountPercentage: event.target.value })} className="h-11 min-w-0 flex-1" />
                      <Input id="promo-discount" type="number" min={1} max={90} className="h-11 w-20 shrink-0" value={form.discountPercentage} onChange={event => setForm({ ...form, discountPercentage: event.target.value })} />
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label htmlFor="promo-valid-from" className="mb-2">Desde</Label><Input id="promo-valid-from" type="date" value={form.validFrom} onChange={event => setForm({ ...form, validFrom: event.target.value })} className="h-11" /></div>
                  <div><Label htmlFor="promo-valid-to" className="mb-2">Hasta (inclusive)</Label><Input id="promo-valid-to" type="date" value={form.validTo} onChange={event => setForm({ ...form, validTo: event.target.value })} className="h-11" /></div>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} className="size-4" /> Activo</label>
              </div>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-background p-4 sm:flex-row sm:justify-end sm:p-5">
              <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
              <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={handleSubmit} disabled={submitting}>{submitting ? "Guardando..." : editing ? "Guardar" : "Crear"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


