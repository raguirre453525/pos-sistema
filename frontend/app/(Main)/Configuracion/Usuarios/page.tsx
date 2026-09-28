"use client";

import { useFeatureGuard } from "@/hooks/useFeatureGuard";
import { DollarSign, TrendingUp, Package } from "lucide-react"
import StatCard from "@/components/Dashboard/StatCard"
import DataTable from "@/components/Reusables/DataTable"
import { columns } from '@/components/Config/Datatable/columns';
import { USERS } from "@/constants/UserInfo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const Page = () => {
  const { allowed } = useFeatureGuard({ denyRoles: ["User"] });
  if (!allowed) {
    return (
      <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Redirigiendo…</p>
      </main>
    );
  }
  return (
    <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
        <Link href={"/Configuracion"}><Button variant="outline" size="icon" className="rounded-md">
        <ArrowLeft />
      </Button></Link>
      <h1 className="text-foreground text-2xl">Usuarios</h1>
      

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card h-full rounded-xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">DETALLES DE Usuarios</h3>
          <DataTable columns={columns} data={USERS} placeholder="Buscar por cliente, ID de venta o fecha..." label="Usuario"/>
        </div>
      </div>
    </main>
  )
}

export default Page



