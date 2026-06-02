"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HrDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["hr-dashboard"],
    queryFn: () => fetch("/api/hr/dashboard").then((r) => r.json()),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">HR Dashboard</h1>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Active Jobs</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data?.activeJobs ?? 0}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total Applications</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data?.totalApplications ?? 0}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Closed Jobs</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data?.closedJobs ?? 0}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Applications This Month</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data?.applicationsThisMonth ?? 0}</p></CardContent></Card>
      </div>
    </div>
  );
}

