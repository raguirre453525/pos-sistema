"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, Store, X, Loader2, Search, SlidersHorizontal, Power, Ban } from "lucide-react";
import { getBusinesses, createBusiness, createUser, type BusinessDto, ApiError, API_URL, getAuthHeaders } from "@/lib/api";
import { useAdminGuard } from "@/hooks/useAdminGuard";

export default function NegociosPage() {
  const { allowed, loading: guardLoading } = useAdminGuard({ redirectTo: "/Ventas" });
  const router = useRouter();

  const [businesses, setBusinesses] = useState<BusinessDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterQ, setFilterQ] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "warning"; msg: string } | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [cuit, setCuit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [adminFullName, setAdminFullName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const showToast = useCallback((type: "success" | "error" | "warning", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchBusinessesCb = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBusinesses();
      setBusinesses(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar comercios";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void fetchBusinessesCb();
  }, [allowed, fetchBusinessesCb]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const resetForm = () => {
    setName("");
    setCuit("");
    setIsActive(true);
    setAdminFullName("");
    setAdminUsername("");
    setAdminPassword("");
    setFormError(null);
  };

  const handleCreate = async () => {
    setFormError(null);
    const n = name.trim();
    const cu = cuit.trim();
    const fn = adminFullName.trim();
    const un = adminUsername.trim();
    const pw = adminPassword;

    if (n.length < 2) {
      setFormError("Nombre requerido (mín 2 caracteres, máx 150)");
      return;
    }
    if (n.length > 150) {
      setFormError("Nombre máx 150 caracteres");
      return;
    }
    if (cu.length > 20) {
      setFormError("CUIT máx 20 caracteres");
      return;
    }
    if (fn.length < 2) {
      setFormError("Nombre completo del Admin requerido (mín 2)");
      return;
    }
    if (un.length < 3) {
      setFormError("Usuario requerido (mín 3)");
      return;
    }
    if (pw.length < 6) {
      setFormError("Contraseña requerida (mín 6)");
      return;
    }

    setCreating(true);
    try {
      const business = await createBusiness({ name: n, cuit: cu || null, isActive });
      const businessId = business.id;
      try {
        await createUser({
          username: un,
          password: pw,
          fullName: fn,
          role: "Admin",
          businessId,
        });
        showToast("success", `Comercio "${n}" y Admin "${un}" creados`);
        setShowNewModal(false);
        resetForm();
        await fetchBusinessesCb();
      } catch (e2) {
        const msg2 = e2 instanceof ApiError ? e2.message : e2 instanceof Error ? e2.message : "Error al crear Admin";
        showToast("warning", `Negocio creado pero Admin falló: ${msg2}`);
        setFormError(`Negocio creado, pero Admin falló: ${msg2}`);
        await fetchBusinessesCb();
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al crear negocio";
      setFormError(msg);
      showToast("error", msg);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (b: BusinessDto) => {
    const next = !b.isActive;
    setTogglingId(b.id);
    const authHeaders = getAuthHeaders() as Record<string, string>;
    const tryEndpoints: Array<{ method: string; path: string; body?: string }> = [
      { method: "PATCH", path: `/api/admin/businesses/${b.id}/toggle` },
      { method: "PUT", path: `/api/admin/businesses/${b.id}/status`, body: JSON.stringify({ isActive: next }) },
      { method: "PATCH", path: `/api/admin/businesses/${b.id}/status`, body: JSON.stringify({ isActive: next }) },
      { method: "PATCH", path: `/api/admin/businesses/${b.id}`, body: JSON.stringify({ isActive: next }) },
    ];
    let succeeded = false;
    for (const ep of tryEndpoints) {
      try {
        const headers: Record<string, string> = { ...authHeaders };
        if (ep.body) headers["Content-Type"] = "application/json";
        const res = await fetch(`${API_URL}${ep.path}`, {
          method: ep.method,
          headers,
          body: ep.body,
        });
        if (res.ok) {
          succeeded = true;
          break;
        }
        if (res.status === 404 || res.status === 405) {
          continue;
        }
        const txt = await res.text();
        let msg = txt || `HTTP ${res.status}`;
        try {
          const j = txt ? JSON.parse(txt) : null;
          if (j && typeof j === "object" && (j.message || j.title || j.detail)) {
            msg = (j.message as string) || (j.title as string) || (j.detail as string) || msg;
          }
        } catch {}
        throw new ApiError(msg, res.status);
      } catch (e) {
        if (e instanceof ApiError && e.status !== 404 && e.status !== 405) {
          showToast("error", e.message);
          setTogglingId(null);
          return;
        }
        // continue to next endpoint on 404/405 or network
        continue;
      }
    }
    if (succeeded) {
      setBusinesses((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: next } : x)));
      showToast("success", next ? `Comercio "${b.name}" activado` : `Comercio "${b.name}" desactivado`);
    } else {
      // optimistic fallback
      setBusinesses((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: next } : x)));
      showToast("warning", "Backend aún no soporta toggle — cambio local");
    }
    setTogglingId(null);
  };

  const filteredBusinesses = businesses.filter((b) => {
    const q = filterQ.trim().toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || (b.cuit ?? "").toLowerCase().includes(q);
  });

  if (guardLoading) {
    return (
      <main className="w-full p-6 text-sm text-muted-foreground">Cargando…</main>
    );
  }

  if (!allowed) {
    return (
      <main className="w-full p-6 text-sm text-muted-foreground">Redirigiendo…</main>
    );
  }

  return (
    <main className="w-full min-w-full max-w-none p-4 md:p-6 flex flex-col gap-6 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Comercios
          </h1>
          <p className="text-sm text-muted-foreground">Gestión de comercios — Panel Maestro SuperAdmin</p>
        </div>
        <Button onClick={() => { setShowNewModal(true); setFormError(null); }} className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nuevo Comercio
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg max-w-sm ${toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : toast.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          {toast.msg}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Cargando comercios…</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex flex-col gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchBusinessesCb()} className="self-start">Reintentar</Button>
          </CardContent>
        </Card>
      ) : businesses.length === 0 ? (
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="p-8 text-center flex flex-col items-center gap-2">
            <Store className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Sin comercios registrados</p>
            <p className="text-xs text-muted-foreground">Creá el primero con Nuevo Comercio</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 dark:border-border shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Listado de comercios ({businesses.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 pb-3 flex flex-col gap-2">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                  placeholder="Filtrar por nombre o CUIT..."
                  className="pl-9 h-9 bg-white dark:bg-card border-slate-200 rounded-lg"
                />
              </div>
              <span className="text-xs text-muted-foreground">Filtrados: {filteredBusinesses.length} de {businesses.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-muted/40 border-y border-slate-200 dark:border-border text-xs text-slate-500 dark:text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                    <th className="text-left px-4 py-3 font-semibold">CUIT / Identificación</th>
                    <th className="text-center px-4 py-3 font-semibold">Estado</th>
                    <th className="text-center px-4 py-3 font-semibold">Usuarios</th>
                    <th className="text-right px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-border">
                  {filteredBusinesses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin resultados para &quot;{filterQ}&quot;</td>
                    </tr>
                  ) : (
                    filteredBusinesses.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{b.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {!b.cuit || b.cuit.trim() === "" ? (
                            <span className="text-xs text-slate-400 italic">Sin registrar</span>
                          ) : (
                            b.cuit
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {b.isActive ? (
                            <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full">Activo</span>
                          ) : (
                            <span className="inline-flex items-center bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold px-2.5 py-1 rounded-full">Inactivo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary">{b.usersCount ?? 0}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/Admin/Licencias?businessId=${b.id}`)}
                              className="border border-slate-300 bg-white text-slate-950 hover:bg-slate-100 hover:text-slate-950 rounded-lg gap-1.5"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" /> Licencias
                            </Button>
                            {b.isActive ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleToggleActive(b)}
                                disabled={togglingId === b.id}
                                title="Suspender comercio"
                                aria-label="Suspender comercio"
                                className="h-7 px-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-700 text-xs font-medium gap-1.5"
                              >
                                {togglingId === b.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Ban className="h-3 w-3" />
                                )}
                                Suspender
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleToggleActive(b)}
                                disabled={togglingId === b.id}
                                title="Activar comercio"
                                aria-label="Activar comercio"
                                className="h-7 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700 text-xs font-medium gap-1.5"
                              >
                                {togglingId === b.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Power className="h-3 w-3" />
                                )}
                                Activar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Nuevo Comercio */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!creating) { setShowNewModal(false); } }}>
          <div className="bg-white dark:bg-card rounded-xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-lg">Nuevo Comercio</h2>
              <Button variant="ghost" size="icon" onClick={() => { if (!creating) { setShowNewModal(false); } }} disabled={creating}><X className="h-4 w-4" /></Button>
            </div>
            <div className="overflow-y-auto p-5 flex flex-col gap-6">
              {/* Datos del Negocio */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">Datos del Negocio</h3>
                <div className="flex flex-col gap-1.5">
                  <Label>Nombre *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} placeholder="Ej: Kiosco Central" className="mt-1" disabled={creating} />
                  <span className="text-xs text-muted-foreground text-right">{name.length}/150</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>CUIT (opcional, máx 20)</Label>
                  <Input value={cuit} onChange={(e) => setCuit(e.target.value)} maxLength={20} placeholder="Ej: 30-12345678-9" className="mt-1" disabled={creating} />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 rounded border-slate-300" disabled={creating} />
                  Activo
                </label>
              </div>

              {/* Admin inicial */}
              <div className="flex flex-col gap-3 border-t pt-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">Admin inicial</h3>
                <div className="flex flex-col gap-1.5">
                  <Label>Nombre completo *</Label>
                  <Input value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} placeholder="Ej: Juan Pérez" disabled={creating} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Usuario *</Label>
                  <Input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Ej: juan.admin" disabled={creating} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Contraseña *</Label>
                  <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Mín 6 caracteres" disabled={creating} />
                </div>
              </div>

              {formError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 shrink-0 bg-slate-50 dark:bg-muted/20">
              <Button variant="outline" onClick={() => { if (!creating) { setShowNewModal(false); resetForm(); } }} disabled={creating}>Cancelar</Button>
              <Button onClick={() => void handleCreate()} disabled={creating} className="bg-slate-900 hover:bg-slate-800 text-white gap-2">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {creating ? "Creando…" : "Crear comercio"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
