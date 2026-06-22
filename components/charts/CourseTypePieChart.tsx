"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type CourseTypePieChartProps = {
  data: { name: string; value: number }[];
};

const COLORS = ["#E30613", "#06B6D4"];

export function CourseTypePieChart({ data }: CourseTypePieChartProps) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No enrollments yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260} className="min-h-[220px] sm:min-h-[300px]">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={3}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
