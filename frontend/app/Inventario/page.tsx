import { STATS_DATA, INV_DATA } from "@/constants/stats"
import StatCard from "@/components/Dashboard/StatCard"
import DataTable from "@/components/Inventario/DataTable/DataTable"
import { columns } from '@/components/Inventario/DataTable/columns';
 import { MOCK_INVENTORY } from "@/constants/inventory";
 
const Page = () => {
  return (
    <main className="min-h-screen bg-gray-50 p-4 flex flex-col gap-6">
      <h1 className="text-gray-700 text-2xl">INVENTARIO</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {INV_DATA.map((stat, index) => (
          <StatCard 
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6">
              <div className="bg-white h-full rounded-2xl border border-gray-200 shadow-sm p-6">
                 <h3 className="text-lg font-semibold mb-4 text-gray-700">PRODUCTOS</h3>
                  <DataTable columns={columns} data={MOCK_INVENTORY}/>
              </div>
        </div>

    </main>
  )
}

export default Page

