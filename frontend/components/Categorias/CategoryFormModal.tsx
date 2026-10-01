"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, updateCategory, CategoryDto, ApiError } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (cat: CategoryDto) => void;
  editingCategory?: CategoryDto | null;
  categories: CategoryDto[];
};

export default function CategoryFormModal({ open, onClose, onSuccess, editingCategory, categories }: Props) {
  const isEditing = !!editingCategory;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync form when opening / editingCategory changes
  useEffect(() => {
    if (open) {
      setName(editingCategory?.name ?? "");
      setDescription(editingCategory?.description ?? "");
      setError(null);
    }
  }, [open, editingCategory]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  const validate = (): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "El nombre es obligatorio";
    if (trimmed.length < 2) return "El nombre debe tener al menos 2 caracteres";
    if (trimmed.length > 100) return "El nombre no puede exceder 100 caracteres";
    if ((description ?? "").length > 500) return "La descripción no puede exceder 500 caracteres";
    const exists = categories.some(
      (c) =>
        c.isActive &&
        c.name.trim().toLowerCase() === trimmed.toLowerCase() &&
        c.id !== editingCategory?.id
    );
    if (exists) return `Ya existe una categoría activa con el nombre "${trimmed}"`;
    return null;
  };

  const handleSave = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dto = {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      };
      let result: CategoryDto;
      if (editingCategory) {
        result = await updateCategory(editingCategory.id, dto);
      } else {
        result = await createCategory(dto);
      }
      // reset and notify
      setName("");
      setDescription("");
      setError(null);
      onSuccess(result);
      onClose();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error al guardar";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = () => {
    if (!saving) onClose();
  };

  const previewName = name.trim() || "Nombre categoría";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={handleOverlayClick}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="bg-card border border-border rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-y-contain flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Editar categoría" : "Nueva categoría"}
      >
        <h3 className="text-lg font-semibold">{isEditing ? "Editar categoría" : "Nueva categoría"}</h3>

        {/* Preview chip */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm">
            <span className="font-medium truncate max-w-[180px]">{previewName}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md border bg-green-50 text-green-700 border-green-200">
              Activa
            </span>
          </span>
          <span className="text-xs text-muted-foreground">Vista previa</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="category-name" className="text-sm font-medium">
            Nombre <span className="text-red-500">*</span>
          </label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Bebidas"
            maxLength={100}
            autoFocus
            className="h-11 sm:h-8"
          />
          <span className="text-xs text-muted-foreground text-right">{name.length}/100</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="category-description" className="text-sm font-medium">Descripción</label>
          <textarea
            id="category-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional"
            maxLength={500}
            rows={3}
            className="min-h-11 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none sm:min-h-0"
          />
          <span className="text-xs text-muted-foreground text-right">{description.length}/500</span>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-2 text-sm">{error}</div>}

        <div className="flex flex-col-reverse gap-2 mt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-11 w-full sm:h-9 sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="h-11 w-full sm:h-9 sm:w-auto">
            {saving ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </div>
  );
}



