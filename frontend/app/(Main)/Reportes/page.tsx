import { DollarSign, TrendingUp, Package } from "lucide-react"
import StatCard from "@/components/Dashboard/StatCard"
import DataTable from "@/components/Inventario/DataTable/DataTable"
import { columns } from '@/components/Reportes/DataTable/columns';
import { MOCK_REPORTS, REPORTS_STATS } from "@/constants/reports";

const Page = () => {
  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-foreground text-2xl">REPORTES</h1>
      
      <div className="flex flex-col md:flex-row gap-6">
        <StatCard 
          title="Ventas Totales"
          value={REPORTS_STATS.ventasTotales.toString()}
          icon={DollarSign}
          color="bg-white-100 text-black-600 border border-gray-200"
        />
        <StatCard 
          title="Ingresos Totales"
          value={`$${REPORTS_STATS.ingresosTotales.toLocaleString()}`}
          icon={TrendingUp}
          color="bg-white-100 text-black-600 border border-gray-200"
        />
        <StatCard 
          title="Productos Vendidos"
          value={REPORTS_STATS.productosVendidos.toString()}
          icon={Package}
          color="bg-white-100 text-black-600 border border-gray-200"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card h-full rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">DETALLE DE VENTAS</h3>
          <DataTable columns={columns} data={MOCK_REPORTS} placeholder="Buscar por cliente, ID de venta o fecha..." label="Venta"/>
        </div>
      </div>
    </main>
  )
}

export default Page
