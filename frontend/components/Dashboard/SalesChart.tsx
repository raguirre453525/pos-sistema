'use client'
import React from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MONTHLY_SALES } from '@/constants/dashboard-data';

const SimpleSalesChart = () => {
  return (
    <div className="flex flex-col h-full w-full">
      
      
      <div className="h-full w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={MONTHLY_SALES} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tickMargin={10} 
              tick={{fill: '#9ca3af', fontSize: 12}}
              tickFormatter={(value) => value.slice(0, 3)} 
            />
            <Tooltip 
              itemStyle={{ color: '#6b7280', fontSize: '14px', fontWeight: 'bold' }} 
              labelStyle={{ color: '#ef4444', fontSize: '12px' }}
              cursor={{fill: '#f9fafb'}} 
              contentStyle={{
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                 
              }} 
            />
            <Bar 
              dataKey="total" 
              fill="#ef4444" 
              radius={[8, 8, 0, 0]} 
              barSize={40} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SimpleSalesChart;
