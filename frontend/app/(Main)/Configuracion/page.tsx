import StatCard from "@/components/Dashboard/StatCard";
import SimpleSalesChart from "@/components/Dashboard/SalesChart";
import CategoryPieChart from "@/components/Dashboard/PieChart";
import DataTable from "@/components/Reusables/DataTable";
import { MOCK_PRODUCTS } from "@/constants/products";
import { columns } from "@/components/Dashboard/DataTable/columns";
import { STATS_DATA } from "@/constants/stats";
import  ConfigBtn  from "@/components/Config/ConfigBtn";
import { Users } from "lucide-react";
const page = () => {
  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-foreground text-2xl">CONFIGURACION</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ConfigBtn link="Configuracion/Usuarios" title="CONFIGURACION" icon={Users} color="bg-white-100 text-black-600 border border-gray-200"></ConfigBtn>

      </div>

        
     
    </main>
  )
}

export default page