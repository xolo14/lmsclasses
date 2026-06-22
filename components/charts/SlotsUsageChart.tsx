"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SlotsUsageChartProps = {
  data: { courseTitle: string; used: number; total: number }[];
};

export function SlotsUsageChart({ data }: SlotsUsageChartProps) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No slot data yet</p>;
  }

  const chartData = data.map((d) => ({
    course: d.courseTitle.length > 18 ? `${d.courseTitle.slice(0, 18)}…` : d.courseTitle,
    used: d.used,
    remaining: Math.max(0, d.total - d.used),
  }));

  return (
    <ResponsiveContainer width="100%" height={260} className="min-h-[220px] sm:min-h-[300px]">
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" stroke="#64748b" fontSize={12} allowDecimals={false} />
        <YAxis type="category" dataKey="course" stroke="#64748b" fontSize={11} width={100} />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
          }}
        />
        <Legend />
        <Bar dataKey="used" name="Used" stackId="slots" fill="#E30613" radius={[0, 0, 0, 0]} />
        <Bar dataKey="remaining" name="Remaining" stackId="slots" fill="#94a3b8" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
