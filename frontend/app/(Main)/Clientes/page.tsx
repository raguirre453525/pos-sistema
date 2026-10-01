"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useFeatureGuard } from "@/hooks/useFeatureGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X, Users, DollarSign } from "lucide-react";
import { getCustomers, getCustomerDetail, createCustomer, registerCustomerPayment, CustomerDto, CustomerDetailDto, ApiError } from "@/lib/api";

export default function ClientesPage() {
  const { allowed } = useFeatureGuard({ requireClientes: true, denyRoles: ["SuperAdmin"], redirectTo: "/Admin/Negocios" });
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaleId, setPaymentSaleId] = useState<string>("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar Clientes";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setPaymentError(null);
    setPaymentSuccess(null);
    try {
      const d = await getCustomerDetail(id);
      setDetail(d);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar detalle";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else setDetail(null);
  }, [selectedId, fetchDetail]);

  const handleCreate = async () => {
    setFormError(null);
    const name = formName.trim();
    if (name.length < 2 || name.length > 100) {
      setFormError("Nombre 2..100 caracteres");
      return;
    }
    if (formPhone.trim().length > 30) {
      setFormError("Teléfono max 30");
      return;
    }
    if (formNote.trim().length > 500) {
      setFormError("Nota max 500");
      return;
    }
    setFormLoading(true);
    try {
      await createCustomer({ name, phone: formPhone.trim() || null, note: formNote.trim() || null });
      setShowDialog(false);
      setFormName("");
      setFormPhone("");
      setFormNote("");
      await fetchCustomers();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al crear";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedId || !detail) return;
    setPaymentError(null);
    setPaymentSuccess(null);
    const amount = Number(paymentAmount);
    if (!(amount > 0)) {
      setPaymentError("Monto > 0");
      return;
    }
    const selectedSale = paymentSaleId ? detail.pendingSales.find((s) => s.id === paymentSaleId) : null;
    const saleRemaining = selectedSale ? Number(selectedSale.total) - Number(selectedSale.paidAmount ?? 0) : null;
    const maxAllowed = saleRemaining != null ? saleRemaining : detail.customer.balance;
    if (amount > maxAllowed) {
      const msg = saleRemaining != null
        ? `No podés pagar más de lo que debe esa venta ($${saleRemaining.toLocaleString("es-AR")})`
        : `No podés pagar más de lo que debe ($${maxAllowed.toLocaleString("es-AR")})`;
      setPaymentError(msg);
      return;
    }
    setPaymentLoading(true);
    try {
      await registerCustomerPayment(selectedId, { amount, note: paymentNote.trim() || null, saleId: paymentSaleId || null });
      setPaymentSuccess(`Pago $${amount.toLocaleString("es-AR")} registrado`);
      setPaymentAmount("");
      setPaymentNote("");
      setPaymentSaleId("");
      await fetchCustomers();
      await fetchDetail(selectedId);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al registrar pago";
      setPaymentError(msg);
    } finally {
      setPaymentLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q));
  }, [customers, search]);

  if (!allowed) {
    return (
      <main className="w-full min-w-0 max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Redirigiendo…</p>
      </main>
    );
  }

  return (
    <main className="w-full min-w-0 max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2"><Users className="h-6 w-6"/>Clientes</h1>
        <Button onClick={() => { setShowDialog(true); setFormError(null); }} className="h-11 w-full gap-1.5 sm:w-auto lg:h-9"><Plus className="h-4 w-4"/> Nuevo cliente</Button>
      </div>

      <div className="flex flex-col gap-3 bg-card border rounded-xl p-3 sm:flex-row sm:items-center lg:p-4">
        <div className="relative w-full max-w-md sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 pl-9 lg:h-8" />
        </div>
        <span className="self-end text-xs text-muted-foreground sm:self-auto">{filtered.length} de {customers.length}</span>
      </div>

      {error && <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 break-words">{error}</span><Button variant="outline" size="sm" onClick={fetchCustomers} className="h-11 self-start sm:self-auto lg:h-8">Reintentar</Button></div>}

      {loading ? (
        <div className="bg-card border rounded-xl p-6 text-center text-sm text-muted-foreground lg:p-8">Cargando Clientes…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-6 text-center flex flex-col items-center gap-2 lg:p-8">
          <Users className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{customers.length === 0 ? "Sin Clientes" : "Sin resultados"}</p>
          {customers.length === 0 && <p className="text-xs text-muted-foreground">Creá el primero con + Nuevo cliente</p>}
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {filtered.map((c) => (
              <button key={c.id} type="button" className="w-full min-w-0 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={() => setSelectedId(c.id)}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{c.name}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{c.phone ?? "—"}</p>
                  </div>
                  <span className={`shrink-0 text-right font-semibold ${c.balance > 0 ? "text-red-600" : "text-green-600"}`}>${Number(c.balance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <span className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Pendientes</span><Badge variant={c.pendingSalesCount > 0 ? "destructive" : "secondary"}>{c.pendingSalesCount}</Badge></span>
                  <span className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Última compra</span><span className="text-right">{c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleDateString("es-AR") : "—"}</span></span>
                  <span className="col-span-2 flex items-center justify-between gap-2"><span className="text-muted-foreground">Debe hace</span>{c.balance > 0 && c.daysSinceDebt != null ? (
                    <span className={`inline-flex rounded-md border px-2 py-0.5 font-semibold ${c.daysSinceDebt > 15 ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{c.daysSinceDebt} días</span>
                  ) : <span className="text-muted-foreground">—</span>}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                    <th className="text-right px-4 py-3 font-semibold">Saldo</th>
                    <th className="text-center px-4 py-3 font-semibold">Pendientes</th>
                    <th className="text-left px-4 py-3 font-semibold">Última compra</th>
                    <th className="text-left px-4 py-3 font-semibold">Debe hace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setSelectedId(c.id)}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.phone ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${c.balance > 0 ? "text-red-600" : "text-green-600"}`}>${Number(c.balance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={c.pendingSalesCount > 0 ? "destructive" : "secondary"}>{c.pendingSalesCount}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleDateString("es-AR") : "—"}</td>
                      <td className="px-4 py-3">
                        {c.balance > 0 && c.daysSinceDebt != null ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${c.daysSinceDebt > 15 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{c.daysSinceDebt} días</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Dialog nuevo cliente */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4" onClick={() => setShowDialog(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="new-customer-title" className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-xl border bg-card p-4 shadow-xl sm:max-h-[calc(100dvh-2rem)] lg:p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 id="new-customer-title" className="text-lg font-semibold">Nuevo cliente</h3>
              <Button variant="ghost" size="icon" aria-label="Cerrar diálogo de nuevo cliente" className="size-11 lg:size-9" onClick={() => setShowDialog(false)}><X className="h-4 w-4"/></Button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} maxLength={100} placeholder="Nombre (2..100)" className="mt-1 h-11 lg:h-8"/>
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} maxLength={30} placeholder="Opcional (max 30)" className="mt-1 h-11 lg:h-8"/>
              </div>
              <div>
                <Label>Nota</Label>
                <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} maxLength={500} placeholder="Opcional (max 500)" className="mt-1 h-11 lg:h-8"/>
              </div>
              {formError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{formError}</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="h-11 w-full sm:w-auto lg:h-9" onClick={() => setShowDialog(false)} disabled={formLoading}>Cancelar</Button>
              <Button className="h-11 w-full sm:w-auto lg:h-9" onClick={handleCreate} disabled={formLoading}>{formLoading ? "Guardando…" : "Crear"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedId(null)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Detalle del cliente" className="h-full w-full min-w-0 max-w-[520px] overflow-hidden border-l bg-card shadow-xl flex flex-col">
            <div className="flex items-start justify-between gap-2 border-b p-4 lg:p-6">
              <div className="flex-1 min-w-0">
                {detailLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : detail ? (
                  <>
                    <h2 className="break-words text-lg font-semibold">{detail.customer.name}</h2>
                    <p className="break-words text-sm text-muted-foreground">{detail.customer.phone ?? "Sin teléfono"} {detail.customer.note ? `· ${detail.customer.note}` : ""}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Saldo</span>
                      <span className={`text-2xl font-semibold tracking-tight text-foreground ${detail.customer.balance > 0 ? "text-red-600" : "text-green-600"}`}>${Number(detail.customer.balance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                      {detail.customer.balance === 0 && <Badge variant="secondary">Sin deuda</Badge>}
                    </div>
                  </>
                ) : <p className="text-sm text-red-600">{detailError}</p>}
              </div>
              <Button variant="ghost" size="icon" aria-label="Cerrar detalle del cliente" className="size-11 shrink-0 lg:size-9" onClick={() => setSelectedId(null)}><X className="h-5 w-5"/></Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 lg:p-6">
              {detailError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{detailError}</p>}
              {detail && (
                <>
                  <section className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 lg:p-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4"/> Registrar pago</h3>
                    <div>
                      <Label>Monto $ *</Label>
                      <Input type="number" min={0} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Ej: 5000" className="mt-1 h-11 lg:h-8" />
                      {detail.customer.balance > 0 && <p className="text-xs text-muted-foreground mt-1">Saldo: ${Number(detail.customer.balance).toLocaleString("es-AR")}</p>}
                    </div>
                    <div>
                      <Label>Nota</Label>
                      <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Opcional" className="mt-1 h-11 lg:h-8"/>
                    </div>
                    {detail.pendingSales.length > 0 && (
                      <div>
                        <Label>Venta (opcional)</Label>
                        <select value={paymentSaleId} onChange={(e) => setPaymentSaleId(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2.5 text-sm lg:h-9">
                          <option value="">— FIFO automático —</option>
                          {detail.pendingSales.map((s) => (
                            <option key={s.id} value={s.id}>{new Date(s.date).toLocaleDateString("es-AR")} — ${Number(s.total).toLocaleString("es-AR")} {s.isCredit ? "(pendiente)" : ""}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Si elegís venta, el pago se imputa a esa venta; si no, FIFO.</p>
                      </div>
                    )}
                    {paymentError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{paymentError}</p>}
                    {paymentSuccess && <p className="text-sm text-green-700 border border-green-200 bg-green-50 rounded p-2">{paymentSuccess}</p>}
                    <Button className="h-11 lg:h-9" onClick={handlePayment} disabled={paymentLoading || !paymentAmount || Number(paymentAmount) <= 0}>
                      {paymentLoading ? "Registrando…" : "Confirmar pago"}
                    </Button>
                  </section>

                  <section className="flex flex-col gap-2">
                    {(() => {
                      const history = detail.allCreditSales && detail.allCreditSales.length > 0 ? detail.allCreditSales : detail.pendingSales;
                      const getStatus = (s: typeof history[number]): "Pagada" | "Vencida" | "Pendiente" => {
                        if (s.creditStatus) {
                          if (s.creditStatus === "Pagada" || s.creditStatus === "Vencida" || s.creditStatus === "Pendiente") return s.creditStatus as "Pagada" | "Vencida" | "Pendiente";
                        }
                        const paid = s.paidAmount ?? 0;
                        const total = Number(s.total);
                        if (paid >= total) return "Pagada";
                        if (s.dueDate && s.isCredit && new Date(s.dueDate) < new Date()) return "Vencida";
                        return "Pendiente";
                      };
                      const badgeFor = (status: string) => {
                        if (status === "Pagada") return <Badge className="bg-green-100 text-green-700 border-green-200 border">Pagada</Badge>;
                        if (status === "Vencida") return <Badge className="bg-red-100 text-red-700 border-red-200 border">Vencida</Badge>;
                        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border">Pendiente</Badge>;
                      };
                      return (
                        <>
                          <h3 className="text-sm font-semibold">Historial fiado ({history.length})</h3>
                          {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">Sin compras fiadas</p>
                          ) : (
                            <>
                              <div className="grid gap-2 lg:hidden">
                                {history.map((s) => {
                                  const status = getStatus(s);
                                  const due = s.dueDate ? new Date(s.dueDate).toLocaleDateString("es-AR") : "—";
                                  const isVencida = status === "Vencida" && s.dueDate;
                                  const daysOver = isVencida ? Math.floor((Date.now() - new Date(s.dueDate as string).getTime()) / 86400000) : 0;
                                  return (
                                    <div key={s.id} className="rounded-md border p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString("es-AR")}</span>
                                        {badgeFor(status)}
                                      </div>
                                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <span className="text-muted-foreground">Total</span>
                                          <p className="font-medium">${Number(s.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Vencimiento</span>
                                          <p>{due}</p>
                                        </div>
                                      </div>
                                      {isVencida && daysOver > 0 && <p className="mt-2 text-xs font-semibold text-red-600">Debe hace {daysOver} días</p>}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="hidden overflow-hidden rounded-md border lg:block">
                                <div className="max-h-[320px] overflow-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                                    <tr>
                                      <th className="text-left px-2 py-2 font-semibold">Fecha</th>
                                      <th className="text-right px-2 py-2 font-semibold">Total</th>
                                      <th className="text-left px-2 py-2 font-semibold">Vencimiento</th>
                                      <th className="text-center px-2 py-2 font-semibold">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {history.map((s) => {
                                      const status = getStatus(s);
                                      const due = s.dueDate ? new Date(s.dueDate).toLocaleDateString("es-AR") : "—";
                                      const isVencida = status === "Vencida" && s.dueDate;
                                      const daysOver = isVencida ? Math.floor((Date.now() - new Date(s.dueDate as string).getTime()) / 86400000) : 0;
                                      return (
                                        <tr key={s.id} className="hover:bg-muted/20">
                                          <td className="px-2 py-2">{new Date(s.date).toLocaleDateString("es-AR")}</td>
                                          <td className="px-2 py-2 text-right font-medium">${Number(s.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                                          <td className="px-2 py-2">
                                            <span>{due}</span>
                                            {isVencida && daysOver > 0 && <span className="ml-1 text-red-600 font-semibold">Debe hace {daysOver} días</span>}
                                          </td>
                                          <td className="px-2 py-2 text-center">{badgeFor(status)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </section>

                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Pagos ({detail.payments.length})</h3>
                    {detail.payments.length === 0 ? <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">Sin pagos</p> : (
                      <div className="border rounded-md divide-y max-h-[220px] overflow-auto">
                        {detail.payments.map((p) => (
                          <div key={p.id} className="flex min-w-0 flex-col gap-1.5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-col">
                              <span className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
                              <span className="max-w-full truncate sm:max-w-[180px]">{p.note ?? "—"}</span>
                            </div>
                            <span className="shrink-0 font-semibold text-green-700">${Number(p.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}




