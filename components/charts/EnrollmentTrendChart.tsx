"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type EnrollmentTrendChartProps = {
  data: { month: string; count: number }[];
};

export function EnrollmentTrendChart({ data }: EnrollmentTrendChartProps) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No enrollment data yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260} className="min-h-[220px] sm:min-h-[300px]">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
        <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#0f172a" }}
        />
        <Bar dataKey="count" name="Enrollments" fill="#E30613" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
