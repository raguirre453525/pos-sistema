'use client'
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label, Tooltip } from 'recharts';
import { CATEGORY_SALES } from '@/constants/dashboard-data';
import { useTheme } from 'next-themes';

const CategoryPieChart = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const totalSales = React.useMemo(() => {
    return CATEGORY_SALES.reduce((acc, curr) => acc + curr.value, 0);
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="h-full w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Tooltip 
              itemStyle={{ color: isDark ? '#cbd5e1' : '#6b7280', fontSize: '14px', fontWeight: 'bold' }} 
              labelStyle={{ color: '#ef4444', fontSize: '12px' }}
              contentStyle={{
                borderRadius: '8px', 
                border: 'none', 
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }} 
            />
            <Pie
              data={CATEGORY_SALES}
              dataKey="value"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              stroke="var(-background)"
              strokeWidth={5}
              paddingAngle={5}
            >
              {CATEGORY_SALES.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className={`${isDark ? 'fill-white' : 'fill-gray-900'} text-2xl font-bold`}
                        >
                          ${totalSales.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className={`${isDark ? 'fill-gray-400' : 'fill-gray-500'} text-xs`}
                        >
                          Total
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CategoryPieChart;
