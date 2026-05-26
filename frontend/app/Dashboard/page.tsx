import React from 'react';
import StatCard from '@/components/Dashboard/StatCard';
import { STATS_DATA } from '@/constants/stats';

const Page = () => {
  return (
    <main className="min-h-screen bg-gray-50 p-6 flex flex-col gap-6">
      
      
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
            <p className="text-gray-400 text-center mt-40 italic">grafico</p>
        </div>
        <div className="lg:col-span-1 bg-white h-96 rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-gray-400 text-center mt-40 italic">grafico</p>
        </div>
      </div>

    </main>
  )
}

export default Page
