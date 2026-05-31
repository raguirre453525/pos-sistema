"use client"
import { ColumnDef } from "@tanstack/react-table"
import { InventoryItem } from "@/constants/inventory"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


export const columns: ColumnDef<InventoryItem>[] = [
    {
        accessorKey: "sku",
        header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          SKU
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    
        cell: ({row}) => {
            return (
                <span className="font-medium">{row.getValue("sku")}</span>
            )
        },
    },
    
    {
        accessorKey: "name",
        header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Producto
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
        cell: ({row}) => {
            const imageSrc = row.original.image

            return (
                <div className="flex item-center gap-3 truncate max-w-[200px]">
                    <Image 
                        src={imageSrc} 
                        alt="Producto" 
                        width={40}
                        height={40}
                        className="rounded-md object-cover" 
                    />
                    <span className="font-medium mt-2">{row.original.name}</span>
                </div>
            )
        },
    },
    {
        accessorKey: "category",

        header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Categoria
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
        cell: ({row}) => {
            return (
                <span className="font-medium">{row.getValue("category")}</span>
            )
        },
    },
    {
        accessorKey: "stock",
        header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Stock
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
        cell: ({row}) => {
            const total = parseFloat(row.getValue("stock") as string)
            return (
                <span className="font-medium">{total.toLocaleString()}</span>
            )
        },
    },
    {
        accessorKey: "price",
       header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Precio
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
        cell: ({row}) => {
            const total = parseFloat(row.getValue("price") as string)
            return (
                <span className="font-medium">{total.toLocaleString()}</span>
            )
        },
    },
    {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const payment = row.original
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
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(payment.name)}
            >
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-500">Eliminar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Copiar SKU</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
  ]
