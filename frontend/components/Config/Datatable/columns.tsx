"use client"
import { ColumnDef } from "@tanstack/react-table"
import { UserInfo } from "@/constants/UserInfo"
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


export const columns: ColumnDef<UserInfo>[] = [
    {
        accessorKey: "username",
        header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nombre de Usuario
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    
        cell: ({row}) => {
            return (
                <span className="font-medium">{row.getValue("username")}</span>
            )
        },
    },
    
    {
        accessorKey: "email",
        header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          E-mail
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    
        cell: ({row}) => {
            return (
                <span className="font-medium">{row.getValue("email")}</span>
            )
        },
    },
    {
        accessorKey: "tipo",

        header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="px-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Permisos
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
        cell: ({row}) => {
            return (
                <span className="font-medium">{row.getValue("tipo")}</span>
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
              onClick={() => navigator.clipboard.writeText(payment.username)}
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
