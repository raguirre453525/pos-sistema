"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { getBusinesses, updateBusinessFeatures, type BusinessDto, ApiError } from "@/lib/api";
import { type FeatureFlags, DEFAULT_FLAGS } from "@/lib/featureFlagsService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SlidersHorizontal } from "lucide-react";

const MODULES: Array<{ key: keyof FeatureFlags; title: string; desc: string }> = [
  { key: "moduloClientes", title: "Clientes y Cuenta Corriente", desc: "Activa vista Clientes y método Fiado" },
  { key: "moduloPromos", title: "Promos y Combos", desc: "Activa pestaña Promos y combos en catálogo" },
  { key: "moduloReportes", title: "Dashboard y Reportes", desc: "Activa analítica y reportes" },
  { key: "permitirAjusteInflacion", title: "Ajuste de Precios / Inflación", desc: "Activa botón de aumento masivo" },
];

const PRESETS: Array<{ label: string; flags: FeatureFlags }> = [
  { label: "Plan Básico", flags: { moduloClientes: false, moduloPromos: false, moduloReportes: false, permitirAjusteInflacion: false } },
  { label: "Plan Estándar", flags: { moduloClientes: true, moduloPromos: false, moduloReportes: true, permitirAjusteInflacion: true } },
  { label: "Plan Full", flags: { moduloClientes: true, moduloPromos: true, moduloReportes: true, permitirAjusteInflacion: true } },
];

function businessToFlags(b: BusinessDto): FeatureFlags {
  return {
    moduloClientes: b.moduloClientes,
    moduloPromos: b.moduloPromos,
    moduloReportes: b.moduloReportes,
    permitirAjusteInflacion: b.permitirAjusteInflacion,
  };
}

function flagsEqual(a: FeatureFlags, b: FeatureFlags): boolean {
  return a.moduloClientes === b.moduloClientes && a.moduloPromos === b.moduloPromos && a.moduloReportes === b.moduloReportes && a.permitirAjusteInflacion === b.permitirAjusteInflacion;
}

export default function LicenciasPage() {
  const { allowed, loading: guardLoading } = useAdminGuard({ redirectTo: "/Ventas" });
  const searchParams = useSearchParams();
  const router = useRouter();
  const { businessId: currentBusinessId, refresh: authRefresh } = useAuth();
  const queryBusinessId = searchParams.get("businessId");

  const [businesses, setBusinesses] = useState<BusinessDto[] | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [localFlags, setLocalFlags] = useState<FeatureFlags>({ ...DEFAULT_FLAGS });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchBusinessesCb = useCallback(async () => {
    setFetchLoading(true);
    setFetchError(null);
    try {
      const list = await getBusinesses();
      setBusinesses(list);
      setSelectedId((prev) => {
        if (queryBusinessId && list.some((b) => b.id === queryBusinessId)) return queryBusinessId;
        if (prev && list.some((b) => b.id === prev)) return prev;
        if (currentBusinessId && list.some((b) => b.id === currentBusinessId)) return currentBusinessId;
        return list[0]?.id ?? "";
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar negocios";
      setFetchError(msg);
      setBusinesses([]);
    } finally {
      setFetchLoading(false);
    }
  }, [currentBusinessId, queryBusinessId]);

  useEffect(() => {
    if (!allowed) return;
    void fetchBusinessesCb();
  }, [allowed, fetchBusinessesCb]);

  // sync query param changes
  useEffect(() => {
    if (!businesses || businesses.length === 0) return;
    if (queryBusinessId && businesses.some((b) => b.id === queryBusinessId) && queryBusinessId !== selectedId) {
      setSelectedId(queryBusinessId);
    }
  }, [queryBusinessId, businesses, selectedId]);

  useEffect(() => {
    if (!businesses || businesses.length === 0) {
      setLocalFlags({ ...DEFAULT_FLAGS });
      return;
    }
    if (!selectedId) {
      setLocalFlags({ ...DEFAULT_FLAGS });
      return;
    }
    const b = businesses.find((x) => x.id === selectedId);
    if (b) {
      setLocalFlags(businessToFlags(b));
    } else {
      setLocalFlags({ ...DEFAULT_FLAGS });
    }
  }, [selectedId, businesses]);

  const handleToggle = (key: keyof FeatureFlags, v: boolean) => {
    setLocalFlags((prev) => ({ ...prev, [key]: v }));
    setSavedMsg(null);
    setSaveError(null);
  };

  const handlePreset = (preset: FeatureFlags) => {
    setLocalFlags({ ...preset });
    setSavedMsg(null);
    setSaveError(null);
  };

  const originalFlags = useMemo(() => {
    if (!businesses || !selectedId) return null;
    const b = businesses.find((x) => x.id === selectedId);
    return b ? businessToFlags(b) : null;
  }, [businesses, selectedId]);

  const isDirty = useMemo(() => {
    if (!originalFlags) return false;
    return !flagsEqual(originalFlags, localFlags);
  }, [originalFlags, localFlags]);

  const activePresetLabel = useMemo(() => {
    const match = PRESETS.find((p) => flagsEqual(p.flags, localFlags));
    return match?.label ?? null;
  }, [localFlags]);

  const handleSave = async () => {
    if (!selectedId) {
      setSaveError("Seleccioná un negocio");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSavedMsg(null);
    try {
      const updated = await updateBusinessFeatures(selectedId, {
        moduloClientes: localFlags.moduloClientes,
        moduloPromos: localFlags.moduloPromos,
        moduloReportes: localFlags.moduloReportes,
        permitirAjusteInflacion: localFlags.permitirAjusteInflacion,
      });
      setBusinesses((prev) => (prev ? prev.map((b) => (b.id === selectedId ? updated : b)) : [updated]));
      const label = businesses?.find((b) => b.id === selectedId)?.name ?? updated.name ?? selectedId.slice(0, 8);
      setSavedMsg(`Guardado para ${label}`);
      setTimeout(() => setSavedMsg(null), 3000);
      if (currentBusinessId && selectedId === currentBusinessId) {
        await authRefresh();
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al guardar";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (guardLoading) {
    return <main className="w-full p-6 text-sm text-muted-foreground">Cargando…</main>;
  }

  if (!allowed) {
    return <main className="w-full p-6 text-sm text-muted-foreground">Redirigiendo…</main>;
  }

  return (
    <main className="w-full min-w-full max-w-none p-4 md:p-6 flex flex-col gap-6 bg-background text-foreground">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6" /> Módulos y Licencias
        </h1>
        <p className="text-sm text-muted-foreground">Solo SuperAdmin puede habilitar/deshabilitar módulos por negocio. Los cambios se guardan vía API y aplican en vivo.</p>
      </div>

      <Card className="border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Configurar funcionalidades por comercio</CardTitle>
          <CardDescription>Seleccioná un comercio y activá los módulos correspondientes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 shrink-0">Negocio:</span>
              {fetchLoading ? (
                <span className="text-sm text-muted-foreground">Cargando negocios…</span>
              ) : fetchError ? (
                <span className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-2 py-1">
                  {fetchError} <Button variant="outline" size="sm" className="ml-2 h-6" onClick={() => void fetchBusinessesCb()}>Reintentar</Button>
                </span>
              ) : businesses && businesses.length > 0 ? (
                <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); router.replace(`/Admin/Licencias?businessId=${v}`); }}>
                  <SelectTrigger className="w-full max-w-xs min-w-[220px] border border-slate-300 dark:border-border rounded-lg bg-white dark:bg-card">
                    <SelectValue placeholder="Seleccionar negocio" />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} {b.id === currentBusinessId ? "· (tu negocio)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-muted-foreground">Sin negocios — {fetchError ?? "lista vacía"}.</span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <Button onClick={() => void fetchBusinessesCb()} variant="outline" disabled={fetchLoading || saving} className="border border-slate-200 dark:border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-muted">Recargar</Button>
              <Button onClick={() => void handleSave()} disabled={saving || !selectedId} className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium shadow-sm rounded-lg px-5 h-9">
                {saving ? "Guardando…" : "Guardar configuración"}
              </Button>
            </div>
          </div>
          {(savedMsg || saveError || isDirty) && (
            <div className="flex flex-wrap gap-2 items-center">
              {savedMsg && <span className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">{savedMsg}</span>}
              {saveError && <span className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{saveError}</span>}
              {isDirty && !savedMsg && !saveError && <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">Cambios sin guardar</span>}
            </div>
          )}

          {fetchError && !fetchLoading && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No se pudo cargar desde API. Los switches muestran valores por defecto. Verificá que el backend esté en http://localhost:5240 y que el token sea de SuperAdmin.
            </div>
          )}

          {/* Presets rápidos */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-muted/50 rounded-lg border border-slate-200/60">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Presets rápidos:</span>
            {PRESETS.map((preset) => {
              const active = activePresetLabel === preset.label;
              return (
                <Button
                  key={preset.label}
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreset(preset.flags)}
                  className={`h-7 px-3 rounded-full text-xs font-medium border-slate-300 bg-white hover:bg-slate-50 ${active ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800 hover:text-white dark:bg-white dark:text-slate-900 dark:border-white" : ""}`}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MODULES.map((m) => (
              <div key={m.key} className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4 flex justify-between items-center gap-4 shadow-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-slate-900 dark:text-foreground">{m.title}</span>
                  <span className="text-xs text-muted-foreground">{m.desc}</span>
                </div>
                <Switch checked={localFlags[m.key]} onCheckedChange={(v) => handleToggle(m.key, v)} aria-label={m.title} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
