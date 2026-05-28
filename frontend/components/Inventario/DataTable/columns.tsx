"use client"
import { ColumnDef } from "@tanstack/react-table"
import { InventoryItem } from "@/constants/inventory"
import Image from "next/image"

export const columns: ColumnDef<InventoryItem>[] = [
    {
        accessorKey: "sku",
        header: "SKU",
        cell: ({row}) => {
            return (
                <span className="font-medium">{row.getValue("sku")}</span>
            )
        },
    },
    {
        accessorKey: "image",
        header: "Producto",
        cell: ({row}) => {
            const imageSrc = row.getValue("image") as string

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
        header: "Categoria",
        cell: ({row}) => {
            return (
                <span className="font-medium">{row.getValue("category")}</span>
            )
        },
    },
    {
        accessorKey: "stock",
        header: "Stock",
        cell: ({row}) => {
            const total = parseFloat(row.getValue("stock") as string)
            return (
                <span className="font-medium">{total.toLocaleString()}</span>
            )
        },
    },
    {
        accessorKey: "price",
        header: "Stock",
        cell: ({row}) => {
            const total = parseFloat(row.getValue("price") as string)
            return (
                <span className="font-medium">{total.toLocaleString()}</span>
            )
        },
    },
  ]
