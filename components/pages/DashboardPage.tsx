"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  GraduationCap,
  IndianRupee,
  BookOpen,
  Video,
} from "lucide-react";
import { KpiCard } from "@/components/charts/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardPageProps {
  scope?: "org" | "global";
}

export function DashboardPage({ scope = "global" }: DashboardPageProps) {
  const { data: stats } = useQuery({
    queryKey: ["dashboard", scope],
    queryFn: () => fetch(`/api/dashboard?scope=${scope}`).then((r) => r.json()),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: () => fetch("/api/payments").then((r) => r.json()),
    enabled: scope === "global",
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => fetch("/api/audit-logs").then((r) => r.json()),
    refetchInterval: 30000,
    enabled: scope === "global",
  });

  const revenueChart = payments
    .filter((p: { status: string }) => p.status === "success")
    .reduce((acc: Record<string, number>, p: { createdAt: string; amount: string }) => {
      const month = new Date(p.createdAt).toLocaleString("en-IN", { month: "short", year: "2-digit" });
      acc[month] = (acc[month] || 0) + parseFloat(p.amount);
      return acc;
    }, {});

  const chartData = Object.entries(revenueChart).map(([month, revenue]) => ({
    month,
    revenue,
  }));

  if (scope === "org") {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="My Students" value={stats?.totalStudents ?? 0} icon={GraduationCap} />
          <KpiCard title="Active Courses" value={stats?.activeCourses ?? 0} icon={BookOpen} />
          <KpiCard title="Slots Remaining" value={stats?.slotsRemaining ?? 0} icon={Building2} />
          <KpiCard title="Payments Made" value={stats?.paymentsMade ?? 0} icon={IndianRupee} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Total Orgs" value={stats?.totalOrgs ?? 0} icon={Building2} />
        <KpiCard title="Total Students" value={stats?.totalStudents ?? 0} icon={GraduationCap} />
        <KpiCard title="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} icon={IndianRupee} />
        <KpiCard title="Active Courses" value={stats?.activeCourses ?? 0} icon={BookOpen} />
        <KpiCard title="Live Classes Today" value={stats?.liveClassesToday ?? 0} icon={Video} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260} className="min-h-[220px] sm:min-h-[300px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                  labelStyle={{ color: "#0f172a" }}
                />
                <Bar dataKey="revenue" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {auditLogs.slice(0, 10).map((log: { id: string; action: string; userName: string; createdAt: string }) => (
                <div key={log.id} className="flex items-start gap-3 text-sm border-b border-border pb-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p><span className="font-medium">{log.userName || "System"}</span> — {log.action}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
              {!auditLogs.length && (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {payments.slice(0, 5).map((p: { id: string; orgName: string; courseTitle: string; amount: string; status: string; createdAt: string }) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-border text-sm">
                <div>
                  <p className="font-medium">{p.orgName}</p>
                  <p className="text-muted-foreground">{p.courseTitle}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-primary">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
