"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X, Users, DollarSign } from "lucide-react";
import { getCustomers, getCustomerDetail, createCustomer, registerCustomerPayment, CustomerDto, CustomerDetailDto, ApiError } from "@/lib/api";

export default function ClientesPage() {
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
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar clientes";
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

  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="h-6 w-6"/>CLIENTES</h1>
          <p className="text-sm text-muted-foreground">Gestión de fiado — saldo, pagos y ventas pendientes</p>
        </div>
        <Button onClick={() => { setShowDialog(true); setFormError(null); }} className="gap-1.5"><Plus className="h-4 w-4"/> Nuevo cliente</Button>
      </div>

      <div className="flex items-center gap-2 bg-card border rounded-2xl p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">{filtered.length} de {customers.length}</span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex justify-between items-center"><span>{error}</span><Button variant="outline" size="sm" onClick={fetchCustomers}>Reintentar</Button></div>}

      {loading ? (
        <div className="bg-card border rounded-2xl p-8 text-center text-sm text-muted-foreground">Cargando clientes…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center flex flex-col items-center gap-2">
          <Users className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{customers.length === 0 ? "Sin clientes" : "Sin resultados"}</p>
          {customers.length === 0 && <p className="text-xs text-muted-foreground">Creá el primero con + Nuevo cliente</p>}
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
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
                      <span className={`font-bold ${c.balance > 0 ? "text-red-600" : "text-green-600"}`}>${Number(c.balance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={c.pendingSalesCount > 0 ? "destructive" : "secondary"}>{c.pendingSalesCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="px-4 py-3">
                      {c.balance > 0 && c.daysSinceDebt != null ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${c.daysSinceDebt > 15 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{c.daysSinceDebt} días</span>
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
      )}

      {/* Dialog nuevo cliente */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDialog(false)}>
          <div className="bg-card rounded-2xl border shadow-xl p-6 w-full max-w-md flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Nuevo cliente</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowDialog(false)}><X className="h-4 w-4"/></Button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} maxLength={100} placeholder="Nombre (2..100)" className="mt-1"/>
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} maxLength={30} placeholder="Opcional (max 30)" className="mt-1"/>
              </div>
              <div>
                <Label>Nota</Label>
                <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} maxLength={500} placeholder="Opcional (max 500)" className="mt-1"/>
              </div>
              {formError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{formError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)} disabled={formLoading}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={formLoading}>{formLoading ? "Guardando…" : "Crear"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedId(null)} aria-hidden />
          <div className="w-full max-w-[520px] bg-card border-l shadow-xl flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                {detailLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : detail ? (
                  <>
                    <h2 className="text-lg font-semibold truncate">{detail.customer.name}</h2>
                    <p className="text-sm text-muted-foreground">{detail.customer.phone ?? "Sin teléfono"} {detail.customer.note ? `· ${detail.customer.note}` : ""}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Saldo</span>
                      <span className={`text-2xl font-black ${detail.customer.balance > 0 ? "text-red-600" : "text-green-600"}`}>${Number(detail.customer.balance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                      {detail.customer.balance === 0 && <Badge variant="secondary">Sin deuda</Badge>}
                    </div>
                  </>
                ) : <p className="text-sm text-red-600">{detailError}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}><X className="h-5 w-5"/></Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {detailError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">{detailError}</p>}
              {detail && (
                <>
                  <section className="border rounded-xl p-4 bg-muted/20 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4"/> Registrar pago</h3>
                    <div>
                      <Label>Monto $ *</Label>
                      <Input type="number" min={0} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Ej: 5000" className="mt-1" />
                      {detail.customer.balance > 0 && <p className="text-xs text-muted-foreground mt-1">Saldo: ${Number(detail.customer.balance).toLocaleString("es-AR")}</p>}
                    </div>
                    <div>
                      <Label>Nota</Label>
                      <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Opcional" className="mt-1"/>
                    </div>
                    {detail.pendingSales.length > 0 && (
                      <div>
                        <Label>Venta (opcional)</Label>
                        <select value={paymentSaleId} onChange={(e) => setPaymentSaleId(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
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
                    <Button onClick={handlePayment} disabled={paymentLoading || !paymentAmount || Number(paymentAmount) <= 0}>
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
                            <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">Sin compras fiadas</p>
                          ) : (
                            <div className="border rounded-lg overflow-hidden">
                              <div className="overflow-x-auto max-h-[320px] overflow-auto">
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
                          )}
                        </>
                      );
                    })()}
                  </section>

                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Pagos ({detail.payments.length})</h3>
                    {detail.payments.length === 0 ? <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">Sin pagos</p> : (
                      <div className="border rounded-lg divide-y max-h-[220px] overflow-auto">
                        {detail.payments.map((p) => (
                          <div key={p.id} className="p-3 flex justify-between items-center text-sm">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
                              <span className="truncate max-w-[180px]">{p.note ?? "—"}</span>
                            </div>
                            <span className="font-bold text-green-700">${Number(p.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
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
