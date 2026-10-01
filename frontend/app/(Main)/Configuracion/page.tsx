"use client";

import { useEffect, useState, useCallback } from "react";
import { Store, Plus, Info, Loader2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL, getAuthHeaders } from "@/lib/api";

type UserDto = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  businessId: string | null;
  businessName: string | null;
  isActive: boolean;
  createdAt: string;
};

function normalizeUser(raw: unknown): UserDto {
  const o = raw as Record<string, unknown>;
  const id = (o["id"] ?? o["Id"] ?? "") as string;
  const username = (o["username"] ?? o["Username"] ?? "") as string;
  const fullName = (o["fullName"] ?? o["FullName"] ?? username) as string;
  const role = (o["role"] ?? o["Role"] ?? "User") as string;
  const businessId = (o["businessId"] ?? o["BusinessId"] ?? null) as string | null;
  const businessName = (o["businessName"] ?? o["BusinessName"] ?? null) as string | null;
  const isActiveRaw = o["isActive"] ?? o["IsActive"];
  const isActive = typeof isActiveRaw === "boolean" ? isActiveRaw : true;
  const createdAt = (o["createdAt"] ?? o["CreatedAt"] ?? new Date().toISOString()) as string;
  return {
    id: String(id),
    username: String(username),
    fullName: String(fullName),
    role: String(role),
    businessId: businessId ? String(businessId) : null,
    businessName: businessName ? String(businessName) : null,
    isActive: Boolean(isActive),
    createdAt: String(createdAt),
  };
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const { role, businessName, loading: authLoading } = useAuth();

  // Guard redirects: User -> /Ventas, SuperAdmin -> /Admin/Negocios
  useEffect(() => {
    if (!authLoading && role === "SuperAdmin") {
      router.replace("/Admin/Negocios");
    } else if (!authLoading && role === "User") {
      router.replace("/Ventas");
    }
  }, [role, router, authLoading]);

  // Users table state
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = useCallback((type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const headers = getAuthHeaders() as Record<string, string>;
      const res = await fetch(`${API_URL}/api/users`, {
        headers,
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text ? { message: text } : null;
      }
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          if (typeof obj.message === "string") msg = obj.message;
          else if (typeof obj.title === "string") msg = obj.title;
          else if (typeof obj.detail === "string") msg = obj.detail;
          if (obj.errors && typeof obj.errors === "object") {
            const errs = obj.errors as Record<string, string[]>;
            const first = Object.values(errs).flat()[0];
            if (first) msg = first;
          }
        }
        if (typeof data === "string" && (data as string).length < 500) msg = data as string;
        throw new Error(msg);
      }
      const list = Array.isArray(data) ? (data as unknown[]) : [];
      setUsers(list.map(normalizeUser));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar usuarios";
      setUsersError(msg);
      showToast("error", msg);
    } finally {
      setLoadingUsers(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (authLoading) return;
    if (role !== "Admin") return;
    void fetchUsers();
  }, [authLoading, role, fetchUsers]);

  // Dialog state
  const [showNewCashier, setShowNewCashier] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setFullName("");
    setUsername("");
    setPassword("");
    setFormError(null);
  };

  const handleCreateCashier = async () => {
    setFormError(null);
    const fn = fullName.trim();
    const unRaw = username.trim();
    const un = unRaw.toLowerCase();
    const pw = password;

    if (!fn) {
      setFormError("Nombre completo requerido");
      return;
    }
    if (fn.length < 2) {
      setFormError("Nombre completo debe tener al menos 2 caracteres");
      return;
    }
    if (!unRaw) {
      setFormError("Nombre de usuario requerido");
      return;
    }
    if (!/^[a-z0-9._-]{3,20}$/.test(un)) {
      setFormError("Usuario: 3-20 caracteres, solo minúsculas, números, . _ - sin espacios");
      return;
    }
    if (!pw || pw.length < 6) {
      setFormError("Contraseña requerida (mín. 6 caracteres)");
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = getAuthHeaders() as Record<string, string>;
      headers["Content-Type"] = "application/json";
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({ username: un, password: pw, fullName: fn, role: "User" }),
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text ? { message: text } : null;
      }
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          if (typeof obj.message === "string") msg = obj.message;
          else if (typeof obj.title === "string") msg = obj.title;
          else if (typeof obj.detail === "string") msg = obj.detail;
          if (obj.errors && typeof obj.errors === "object") {
            const errs = obj.errors as Record<string, string[]>;
            const first = Object.values(errs).flat()[0];
            if (first) msg = first;
          }
        }
        if (typeof data === "string" && (data as string).length < 500) msg = data as string;
        throw new Error(msg);
      }
      showToast("success", `Cajero "${fn}" creado`);
      setShowNewCashier(false);
      resetForm();
      await fetchUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear cajero";
      setFormError(msg);
      showToast("error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  if (role === "SuperAdmin") {
    return (
      <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Redirigiendo a /Admin/Negocios…</p>
      </main>
    );
  }

  if (role === "User") {
    return (
      <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Redirigiendo…</p>
      </main>
    );
  }

  // Admin local — store configuration
  return (
    <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>

      <Card className="border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5" /> Configuración de Tienda
          </CardTitle>
          <CardDescription>Configuración general de tu comercio</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/30 p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Tu comercio</span>
            <span className="text-lg font-semibold text-foreground">{businessName ?? "—"}</span>
          </div>
          <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200/60 rounded-lg p-3 flex gap-2 items-start">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
            <span>Configuración general de tu comercio. Para solicitar nuevos módulos o ampliar tu plan, comunicate con soporte.</span>
          </div>
        </CardContent>
      </Card>

      {/* Personal de la tienda — Users/Cajeros table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 bg-white">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Personal de la tienda</h3>
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-700 font-medium">
              {users.length} usuarios
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setShowNewCashier(true);
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 h-8 max-lg:min-h-11 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cajero
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loadingUsers ? (
            <div className="p-6 flex flex-col gap-3">
              <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
              <p className="text-xs text-muted-foreground mt-2">Cargando usuarios…</p>
            </div>
          ) : usersError && users.length === 0 ? (
            <div className="p-6 flex flex-col gap-3 items-center">
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 w-full text-center">{usersError}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchUsers()} className="rounded-lg">
                Reintentar
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Sin cajeros aún — creá el primero con Nuevo Cajero</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold">Rol</th>
                  <th className="text-left px-4 py-3 font-semibold">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isOwner = u.role === "Admin";
                  const isActive = u.isActive;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.username}</td>
                      <td className="px-4 py-3">
                        {isOwner ? (
                          <span className="inline-flex items-center bg-slate-900 text-white border border-slate-900 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            Dueño
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            Cajero
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isActive ? (
                          <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-slate-100 text-slate-500 border border-slate-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">—</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Dialog + Nuevo Cajero */}
      {showNewCashier && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (!isSubmitting) setShowNewCashier(false);
          }}
        >
          <div
            className="bg-white dark:bg-card rounded-xl border shadow-xl w-full max-w-md overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-lg">Nuevo Cajero</h2>
              <Button variant="ghost" size="icon" onClick={() => { if (!isSubmitting) setShowNewCashier(false); }} disabled={isSubmitting} className="max-lg:min-h-11 max-lg:min-w-11">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cashier-fullName">Nombre completo</Label>
                <Input
                  id="cashier-fullName"
                  autoFocus
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cashier-username">Nombre de usuario</Label>
                <Input
                  id="cashier-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="juan.perez"
                  disabled={isSubmitting}
                />
                <span className="text-xs text-muted-foreground">3-20 caracteres: a-z 0-9 . _ - sin espacios, ej: juan.perez</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cashier-password">Contraseña</Label>
                <Input
                  id="cashier-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  disabled={isSubmitting}
                />
              </div>
              {formError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 shrink-0 bg-slate-50 dark:bg-muted/20">
              <Button variant="outline" onClick={() => { if (!isSubmitting) { setShowNewCashier(false); resetForm(); } }} disabled={isSubmitting} className="max-lg:min-h-11">
                Cancelar
              </Button>
              <Button
                onClick={() => void handleCreateCashier()}
                disabled={isSubmitting}
                className="bg-slate-900 hover:bg-slate-800 text-white gap-2 max-lg:min-h-11"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando…" : "Crear cajero"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg max-w-sm ${
            toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}
