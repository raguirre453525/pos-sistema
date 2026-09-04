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
        const imgSrc = (p as any).imageUrl as string | null | undefined;
        const resolved = imgSrc ? (imgSrc.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5240"}${imgSrc}` : imgSrc) : "/img-prod.webp";
        const isExternal = resolved.startsWith("http");
        return (
          <div className="flex item-center gap-3 truncate max-w-[240px]">
            {isExternal ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolved} alt={p.name} width={40} height={40} className="rounded-md object-cover h-10 w-10" onError={(e) => ((e.target as HTMLImageElement).src = "/img-prod.webp")} />
            ) : (
              <Image src={resolved} alt={p.name} width={40} height={40} className="rounded-md object-cover" />
            )}
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
        const p = row.original as any;
        const minStock = (p.minStock ?? null) as number | null;
        const unit = (p.unit ?? null) as string | null;
        const isSoldByWeight = (p.isSoldByWeight ?? false) as boolean;
        const isWeight = isSoldByWeight === true || (unit ?? "").toLowerCase() === "kg";
        const unitLabel = isWeight ? "kg" : "un.";
        const stockStr = Number(stock).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        const isOut = stock <= 0;
        const isLow = stock > 0 && (minStock != null ? stock <= minStock : stock <= 5);
        return (
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`font-medium px-2 py-0.5 rounded-md text-xs border ${
                isOut
                  ? "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                  : isLow
                    ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                    : "bg-transparent border-transparent"
              }`}
            >
              {stockStr} {unitLabel}
            </span>
            {isLow && (
              <span className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                ¡Poco stock!
              </span>
            )}
            {isOut && (
              <span className="inline-flex items-center rounded-full bg-zinc-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                Sin stock
              </span>
            )}
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

