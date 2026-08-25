"use client";
import { ColumnDef } from "@tanstack/react-table";
import { ProductDto, CategoryDto } from "@/lib/api";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

type ProductColumnsOpts = {
  onAdjust?: (product: ProductDto) => void;
  onDelete?: (product: ProductDto) => void;
  categoryMap?: Record<string, CategoryDto[]>;
  categories?: CategoryDto[];
  onAssign?: (product: ProductDto, categoryId: string) => void;
  onRemove?: (product: ProductDto, categoryId: string) => void;
};

export function createProductColumns(opts: ProductColumnsOpts = {}): ColumnDef<ProductDto>[] {
  return [
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          SKU
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue("sku")}</span>,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Producto
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex item-center gap-3 truncate max-w-[240px]">
            <Image
              src="/img-prod.webp"
              alt={p.name}
              width={40}
              height={40}
              className="rounded-md object-cover"
            />
            <span className="font-medium mt-2 truncate">{p.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Precio
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const price = row.getValue("price") as number;
        return <span className="font-medium">${Number(price).toLocaleString("es-AR")}</span>;
      },
    },
    {
      accessorKey: "stock",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Stock
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const stock = row.getValue("stock") as number;
        const low = stock <= 5;
        const zero = stock === 0;
        return (
          <span
            className={`font-medium px-2 py-0.5 rounded-full text-xs ${zero ? "bg-red-100 text-red-700 border border-red-200" : low ? "bg-amber-100 text-amber-700 border border-amber-200" : ""}`}
          >
            {stock.toLocaleString()}
          </span>
        );
      },
    },
    {
      id: "categorias",
      header: "Categorías",
      cell: ({ row }) => {
        const p = row.original;
        const cats = opts.categoryMap?.[p.id] ?? [];
        if (cats.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {cats.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {c.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Descripción",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] inline-block">
          {row.original.description ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const product = row.original;
        const assigned = opts.categoryMap?.[product.id] ?? [];
        const assignedIds = new Set(assigned.map((c) => c.id));
        const unassigned = (opts.categories ?? []).filter((c) => !assignedIds.has(c.id));

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => opts.onAdjust?.(product)}>Ajustar stock</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(product.sku)}>Copiar SKU</DropdownMenuItem>

              {opts.categories !== undefined && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Asignar categoría</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {unassigned.length === 0 ? (
                        <DropdownMenuItem disabled className="text-xs">
                          {assigned.length === (opts.categories?.length ?? 0) ? "Todas asignadas" : "Sin categorías"}
                        </DropdownMenuItem>
                      ) : (
                        unassigned.map((c) => (
                          <DropdownMenuItem key={c.id} onClick={() => opts.onAssign?.(product, c.id)}>
                            {c.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  {assigned.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Quitar categoría</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {assigned.map((c) => (
                          <DropdownMenuItem key={c.id} onClick={() => opts.onRemove?.(product, c.id)}>
                            {c.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-500" onClick={() => opts.onDelete?.(product)}>
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
