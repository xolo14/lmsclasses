"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type FunnelChartProps = {
  data: { label: string; count: number }[];
};

const COLORS = ["#94a3b8", "#64748b", "#E30613", "#059669"];

export function FunnelChart({ data }: FunnelChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" stroke="#64748b" fontSize={12} allowDecimals={false} />
        <YAxis type="category" dataKey="label" stroke="#64748b" fontSize={12} width={120} />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
