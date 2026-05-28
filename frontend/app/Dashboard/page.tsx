import React from 'react';
import StatCard from '@/components/Dashboard/StatCard';
import { STATS_DATA } from '@/constants/stats';
import SimpleSalesChart from '@/components/Dashboard/SalesChart';
import CategoryPieChart from '@/components/Dashboard/PieChart';
import DataTable from '@/components/Dashboard/DataTable/DataTable';
import { MOCK_PRODUCTS } from '@/constants/products';
import { columns } from '@/components/Dashboard/DataTable/columns';

 const topProducts = [...MOCK_PRODUCTS]
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 5)
const Page = () => {
  return (
    <main className="min-h-screen bg-gray-50 p-4 flex flex-col gap-6">
      <h1 className="text-gray-700 text-2xl">DASHBOARD</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {STATS_DATA.map((stat, index) => (
          <StatCard 
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white h-96 rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">VENTAS ULTIMOS MESES</h3>
            <SimpleSalesChart />
        </div>
        <div className="lg:col-span-1 bg-white h-96 rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">VENTAS POR CATEGORIA</h3>
            <CategoryPieChart />
        </div>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white h-full rounded-2xl border border-gray-200 shadow-sm p-6">
           <h3 className="text-lg font-semibold mb-4 text-gray-700">RANKING DE PRODUCTOS</h3>
            <DataTable columns={columns} data={topProducts}/>
        </div>
       </div>

    </main>
  )
}

export default Page
