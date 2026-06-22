"use client";

import dynamic from "next/dynamic";
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
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";

const RevenueChart = dynamic(
  () => import("@/components/charts/RevenueChart").then((m) => m.RevenueChart),
  {
    ssr: false,
    loading: () => <div className="h-[260px] animate-pulse rounded-lg bg-muted" />,
  }
);

const EnrollmentTrendChart = dynamic(
  () => import("@/components/charts/EnrollmentTrendChart").then((m) => m.EnrollmentTrendChart),
  {
    ssr: false,
    loading: () => <div className="h-[260px] animate-pulse rounded-lg bg-muted" />,
  }
);

const SlotsUsageChart = dynamic(
  () => import("@/components/charts/SlotsUsageChart").then((m) => m.SlotsUsageChart),
  {
    ssr: false,
    loading: () => <div className="h-[260px] animate-pulse rounded-lg bg-muted" />,
  }
);

const CourseTypePieChart = dynamic(
  () => import("@/components/charts/CourseTypePieChart").then((m) => m.CourseTypePieChart),
  {
    ssr: false,
    loading: () => <div className="h-[260px] animate-pulse rounded-lg bg-muted" />,
  }
);

interface DashboardPageProps {
  scope?: "org" | "global";
  userRole?: string;
}

type DashboardStats = {
  totalOrgs?: number;
  totalStudents?: number;
  totalRevenue?: number | string;
  activeCourses?: number;
  liveClassesToday?: number;
  slotsRemaining?: number;
  paymentsMade?: number;
};

type PaymentRow = {
  id: string;
  orgName: string;
  courseTitle: string;
  amount: string;
  status: string;
  createdAt: string;
};

type AuditRow = {
  id: string;
  action: string;
  userName: string;
  createdAt: string;
};

type OrgAnalytics = {
  summary: {
    totalStudents: number;
    activeLiveCourses: number;
    slotsRemaining: number;
    slotsUsed: number;
    paymentsMade: number;
    totalSpent: number;
    liveEnrollments: number;
    recordEnrollments: number;
  };
  spendingByMonth: { month: string; amount: number }[];
  enrollmentsByMonth: { month: string; count: number }[];
  slotsByCourse: { courseTitle: string; used: number; total: number }[];
  courseTypeSplit: { name: string; value: number }[];
  recentPayments: {
    id: string;
    courseTitle: string | null;
    amount: string;
    status: string;
    createdAt: string;
  }[];
  recentActivity: { id: string; action: string; createdAt: string }[];
};

type PaginatedResponse<T> = {
  data: T[];
  nextCursor?: string | null;
  hasNextPage?: boolean;
};

function asArray<T>(value: T[] | PaginatedResponse<T> | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return Array.isArray(value.data) ? value.data : [];
}

export function DashboardPage({ scope = "global", userRole }: DashboardPageProps) {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard", scope],
    queryFn: () => fetchJson<DashboardStats>(`/api/dashboard?scope=${scope}`),
  });

  const { data: paymentsRaw } = useQuery<PaymentRow[] | PaginatedResponse<PaymentRow>>({
    queryKey: ["payments"],
    queryFn: () => fetchJson<PaymentRow[] | PaginatedResponse<PaymentRow>>("/api/payments"),
    enabled: scope === "global",
  });

  const { data: auditLogsRaw } = useQuery<AuditRow[] | PaginatedResponse<AuditRow>>({
    queryKey: ["audit-logs", "dashboard"],
    queryFn: () => fetchJson<AuditRow[] | PaginatedResponse<AuditRow>>("/api/audit-logs"),
    enabled: scope === "global" && userRole === "super_admin",
    staleTime: 2 * 60 * 1000,
  });

  const { data: orgAnalytics, isLoading: orgAnalyticsLoading } = useQuery<OrgAnalytics>({
    queryKey: ["org-admin-analytics"],
    queryFn: () => fetchJson<OrgAnalytics>("/api/org-admin/analytics"),
    enabled: scope === "org",
    staleTime: 2 * 60 * 1000,
  });

  const payments = asArray(paymentsRaw);
  const auditLogs = asArray(auditLogsRaw);

  const revenueChart = payments
    .filter((p) => p.status === "success")
    .reduce((acc: Record<string, number>, p) => {
      const month = new Date(p.createdAt).toLocaleString("en-IN", {
        month: "short",
        year: "2-digit",
      });
      acc[month] = (acc[month] || 0) + parseFloat(p.amount);
      return acc;
    }, {});

  const chartData = Object.entries(revenueChart).map(([month, revenue]) => ({
    month,
    revenue,
  }));

  if (scope === "org") {
    const summary = orgAnalytics?.summary;
    const spendingChartData = (orgAnalytics?.spendingByMonth ?? []).map((row) => ({
      month: row.month,
      revenue: row.amount,
    }));

    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="My Students"
            value={summary?.totalStudents ?? stats?.totalStudents ?? 0}
            icon={GraduationCap}
          />
          <KpiCard
            title="Active Live Courses"
            value={summary?.activeLiveCourses ?? stats?.activeCourses ?? 0}
            icon={BookOpen}
          />
          <KpiCard
            title="Slots Remaining"
            value={summary?.slotsRemaining ?? stats?.slotsRemaining ?? 0}
            icon={Building2}
          />
          <KpiCard
            title="Payments Made"
            value={summary?.paymentsMade ?? stats?.paymentsMade ?? 0}
            icon={IndianRupee}
          />
          <KpiCard
            title="Total Spent"
            value={formatCurrency(summary?.totalSpent ?? 0)}
            icon={IndianRupee}
          />
        </div>

        {orgAnalyticsLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-[320px] animate-pulse rounded-lg bg-muted" />
            <div className="h-[320px] animate-pulse rounded-lg bg-muted" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Spending by Month</CardTitle>
                </CardHeader>
                <CardContent>
                  {spendingChartData.some((d) => d.revenue > 0) ? (
                    <RevenueChart data={spendingChartData} />
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">No payments yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Enrollments by Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <EnrollmentTrendChart data={orgAnalytics?.enrollmentsByMonth ?? []} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Slots by Course</CardTitle>
                </CardHeader>
                <CardContent>
                  <SlotsUsageChart data={orgAnalytics?.slotsByCourse ?? []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Live vs Record Enrollments</CardTitle>
                </CardHeader>
                <CardContent>
                  <CourseTypePieChart data={orgAnalytics?.courseTypeSplit ?? []} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {(orgAnalytics?.recentPayments ?? []).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 border-b border-border text-sm"
                      >
                        <div>
                          <p className="font-medium">{p.courseTitle ?? "Course"}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.status}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-primary">{formatCurrency(p.amount)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                    {!orgAnalytics?.recentPayments?.length && (
                      <p className="text-sm text-muted-foreground">No payments yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Student Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {(orgAnalytics?.recentActivity ?? []).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 text-sm border-b border-border pb-3"
                      >
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                    {!orgAnalytics?.recentActivity?.length && (
                      <p className="text-sm text-muted-foreground">No student activity yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
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
        <Card className={cn(userRole !== "super_admin" && "lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={chartData} />
          </CardContent>
        </Card>

        {userRole === "super_admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {auditLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm border-b border-border pb-3">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p>
                        <span className="font-medium">{log.userName || "System"}</span> — {log.action}
                      </p>
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
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {payments.slice(0, 5).map((p) => (
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
