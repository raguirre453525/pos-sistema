import { STATS_DATA, INV_DATA } from "@/constants/stats"
import StatCard from "@/components/Dashboard/StatCard"
import DataTable from "@/components/Reusables/DataTable"
import { columns } from '@/components/Inventario/DataTable/columns';
 import { MOCK_INVENTORY } from "@/constants/inventory";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package, PackagePlus  } from "lucide-react";

// icon: Package,
//         color: "bg-white-100 text-black-600 border border-gray-200",

const Page = () => {
  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-foreground text-2xl">INVENTARIO</h1>
      
      <div className="flex justify-between items-center">
        
          <StatCard 
            key={"1"}
            title={"Valor Total de Activos"}
            value={"$125,400,000.00"}
            icon={Package}
            color={"bg-white-100 text-black-600 border border-gray-200"}
          />
        
        <Link href="/Inventario/CrearProd"><Button  variant="outline" size="lg" className="flex ml-auto mt-20"> <PackagePlus className="mr-1"/>Crear Producto</Button></Link>
        
      </div>
      <div className="grid grid-cols-1 gap-6">
              <div className="bg-card h-full rounded-2xl border border-border shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">PRODUCTOS</h3>
                   <DataTable columns={columns} data={MOCK_INVENTORY} label="Producto"/>
              </div>
        </div>
      
    </main>
  )
}

export default Page

