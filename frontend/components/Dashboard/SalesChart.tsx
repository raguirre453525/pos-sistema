'use client'
import React from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MONTHLY_SALES } from '@/constants/dashboard-data';
import { useTheme } from 'next-themes';

const SimpleSalesChart = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex flex-col h-full w-full">
      <div className="h-full w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={MONTHLY_SALES} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tickMargin={10} 
              tick={{fill: 'var(--muted-foreground)', fontSize: 12}}
              tickFormatter={(value) => value.slice(0, 3)} 
            />
            <Tooltip 
              itemStyle={{ color: 'var(--foreground)', fontSize: '14px', fontWeight: 'bold' }} 
              labelStyle={{ color: '#ef4444', fontSize: '12px' }}
              cursor={{fill: 'var(--muted)'}} 
              contentStyle={{
                borderRadius: '8px', 
                border: 'none', 
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }} 
            />
            <Tooltip 
              itemStyle={{ color: isDark ? '#cbd5e1' : '#6b7280', fontSize: '14px', fontWeight: 'bold' }} 
              labelStyle={{ color: '#ef4444', fontSize: '12px' }}
              cursor={{fill: isDark ? '#1e293b' : '#f9fafb'}} 
              contentStyle={{
                borderRadius: '8px', 
                border: 'none', 
                backgroundColor: isDark ? '#1e293b' : '#fff',
                color: isDark ? '#f1f5f9' : '#0f172a',
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
