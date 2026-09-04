"use client"
import { ColumnDef } from "@tanstack/react-table"
import { Product } from "@/constants/products"
import Image from "next/image"

export const columns: ColumnDef<Product>[] = [
    {
        accessorKey: "Position",
        header: "Posicion",
        cell: ({row}) => {
            return <span className="font-semibold">{row.index + 1}</span>
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
        accessorKey: "id",
        header: "SKU",
        cell: ({row}) => {
            return (
                <span className="font-medium">{row.getValue("id")}</span>
            )
        },
    },
    {
        accessorKey: "totalSales",
        header: "Ventas Totales",
        cell: ({row}) => {
            const total = parseFloat(row.getValue("totalSales") as string)
            return (
                <span className="font-medium">{total.toLocaleString()}</span>
            )
        },
    },
  ]

