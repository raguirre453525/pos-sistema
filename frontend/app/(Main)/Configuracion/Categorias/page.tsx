"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Search, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  CategoryDto,
  ApiError,
} from "@/lib/api";

export default function CategoriasPage() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDto | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al cargar categorías";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  // auto-dismiss success banner
  useEffect(() => {
    if (!bannerSuccess) return;
    const t = setTimeout(() => setBannerSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [bannerSuccess]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q)
    );
  }, [categories, searchTerm]);

  const openCreate = () => {
    setEditingCategory(null);
    setFormName("");
    setFormDescription("");
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEdit = (cat: CategoryDto) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormDescription(cat.description ?? "");
    setFormError(null);
    setShowCreateModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowCreateModal(false);
    setEditingCategory(null);
    setFormError(null);
  };

  const validate = (): string | null => {
    const name = formName.trim();
    if (!name) return "El nombre es obligatorio";
    if (name.length < 2) return "El nombre debe tener al menos 2 caracteres";
    if (name.length > 100) return "El nombre no puede exceder 100 caracteres";
    if ((formDescription ?? "").length > 500) return "La descripción no puede exceder 500 caracteres";
    // unique case-insensitive among active, excluding current editing
    const exists = categories.some(
      (c) =>
        c.isActive &&
        c.name.trim().toLowerCase() === name.toLowerCase() &&
        c.id !== editingCategory?.id
    );
    if (exists) return `Ya existe una categoría activa con el nombre "${name}"`;
    return null;
  };

  const handleSave = async () => {
    const validationMsg = validate();
    if (validationMsg) {
      setFormError(validationMsg);
      return;
    }
    setSaving(true);
    setFormError(null);
    setBannerError(null);
    try {
      const dto = {
        name: formName.trim(),
        description: formDescription.trim() ? formDescription.trim() : null,
      };
      if (editingCategory) {
        await updateCategory(editingCategory.id, dto);
        setBannerSuccess(`Categoría "${dto.name}" actualizada`);
      } else {
        await createCategory(dto);
        setBannerSuccess(`Categoría "${dto.name}" creada`);
      }
      setShowCreateModal(false);
      setEditingCategory(null);
      await fetchCategories();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al guardar";
      setFormError(msg);
      // If 409 duplicate from backend, keep modal open with error
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (cat: CategoryDto) => {
    setDeleteConfirmId(cat.id);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const cat = categories.find((c) => c.id === deleteConfirmId);
    setDeleteLoading(true);
    setDeleteError(null);
    setBannerError(null);
    try {
      await deleteCategory(deleteConfirmId);
      setBannerSuccess(`Categoría "${cat?.name ?? ""}" desactivada`);
      setDeleteConfirmId(null);
      await fetchCategories();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al eliminar";
      const is409 = e instanceof ApiError && e.status === 409;
      if (is409) {
        // backend says has active products
        const count = cat?.productCount ?? 0;
        const detail = count > 0
          ? `Tiene ${count} producto${count === 1 ? "" : "s"} activo${count === 1 ? "" : "s"}, quitá los productos de la categoría primero.`
          : msg;
        setDeleteError(detail);
        setBannerError(detail);
      } else {
        setDeleteError(msg);
        setBannerError(msg);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const deleteTarget = deleteConfirmId ? categories.find((c) => c.id === deleteConfirmId) : null;

  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      {/* Breadcrumb / header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/Configuracion"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Configuración
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Tag className="h-6 w-6" />
              Categorías
            </h1>
            <p className="text-sm text-muted-foreground">Gestioná las categorías de productos</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva categoría
          </Button>
        </div>
      </div>

      {/* Banners */}
      {bannerSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">
          {bannerSuccess}
        </div>
      )}
      {bannerError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex justify-between items-center gap-2">
          <span>{bannerError}</span>
          <button onClick={() => setBannerError(null)} className="text-xs underline shrink-0">
            Cerrar
          </button>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border rounded-2xl p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {loading ? "Cargando..." : `${filtered.length} de ${categories.length}`}
        </span>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border rounded-2xl p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/2 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-2/3 mb-4" />
              <div className="flex gap-2">
                <div className="h-7 bg-muted rounded w-16" />
                <div className="h-7 bg-muted rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center justify-between gap-2">
          <span className="text-sm">{error}</span>
          <Button variant="outline" size="sm" onClick={fetchCategories}>
            Reintentar
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center flex flex-col items-center gap-3">
          <Tag className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sin categorías — creá la primera</p>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nueva categoría
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No se encontraron categorías para &quot;{searchTerm}&quot;
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cat) => (
            <div
              key={cat.id}
              className="bg-card border rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-base leading-tight truncate pr-2">{cat.name}</h3>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                    cat.isActive
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}
                >
                  {cat.isActive ? "Activa" : "Inactiva"}
                </span>
              </div>

              {cat.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">{cat.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic min-h-[2.5rem]">Sin descripción</p>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground bg-muted border rounded-full px-2.5 py-1">
                  {cat.productCount} producto{cat.productCount === 1 ? "" : "s"}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Editar ${cat.name}`} onClick={() => openEdit(cat)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar ${cat.name}`}
                    onClick={() => confirmDelete(cat)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-semibold">{editingCategory ? "Editar categoría" : "Nueva categoría"}</h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Bebidas"
                maxLength={100}
                autoFocus
              />
              <span className="text-xs text-muted-foreground text-right">{formName.length}/100</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Descripción</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descripción opcional"
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
              />
              <span className="text-xs text-muted-foreground text-right">{formDescription.length}/500</span>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm">{formError}</div>
            )}

            <div className="flex justify-end gap-2 mt-1">
              <Button variant="outline" onClick={closeModal} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editingCategory ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirmId && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-semibold">¿Eliminar &quot;{deleteTarget.name}&quot;?</h3>
            <p className="text-sm text-muted-foreground">
              Se desactivará la categoría. Esta acción no elimina los productos asociados.
            </p>
            {deleteTarget.productCount > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Esta categoría tiene {deleteTarget.productCount} producto{deleteTarget.productCount === 1 ? "" : "s"} activo
                {deleteTarget.productCount === 1 ? "" : "s"}. Si intentás eliminarla, el servidor responderá con error 409.
              </p>
            )}
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm">{deleteError}</div>
            )}
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleteLoading}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
