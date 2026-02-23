"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MonthlyChartProps {
  data: Array<{
    month: string;
    label: string;
    revenue: number;
    expenses: number;
  }>;
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const hasData = data.some((d) => d.revenue > 0 || d.expenses > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        No data to display yet. Start logging transactions!
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              `$${(v / 1000).toFixed(0)}k`
            }
          />
          <Tooltip
            formatter={(value) =>
              `$${Number(value).toLocaleString("en-CA", { minimumFractionDigits: 2 })}`
            }
          />
          <Legend />
          <Bar
            dataKey="revenue"
            name="Revenue"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="expenses"
            name="Expenses"
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
