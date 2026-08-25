"use client";
import { ColumnDef } from "@tanstack/react-table";
import { ProductDto } from "@/lib/api";
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
} from "@/components/ui/dropdown-menu";

type ProductColumnsOpts = {
  onAdjust?: (product: ProductDto) => void;
  onDelete?: (product: ProductDto) => void;
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
              <DropdownMenuItem onClick={() => opts.onAdjust?.(product)}>
                Ajustar stock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(product.sku)}>
                Copiar SKU
              </DropdownMenuItem>
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
