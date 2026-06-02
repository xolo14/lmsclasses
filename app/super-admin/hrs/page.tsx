"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type HrRow = {
  id: string;
  hrName: string;
  companyName: string;
  email: string;
  designation: string | null;
  registrationDate: string;
  verificationStatus: string;
  totalActiveJobs: number;
  totalJobsPosted: number;
  totalApplicationsReceived: number;
  isActive: boolean;
};

export default function SuperAdminHrsPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedHrId, setSelectedHrId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{
    items: HrRow[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>({
    queryKey: ["super-admin-hrs", page, query],
    queryFn: () =>
      fetch(`/api/super-admin/hrs?page=${page}&pageSize=10&q=${encodeURIComponent(query)}`).then((r) => r.json()),
  });
  const hrs = data?.items ?? [];

  const toggleStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch("/api/super-admin/hrs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");
      return json;
    },
    onSuccess: () => refetch(),
  });

  const details = useQuery<any>({
    queryKey: ["super-admin-hr-detail", selectedHrId],
    enabled: !!selectedHrId,
    queryFn: () => fetch(`/api/super-admin/hrs/${selectedHrId}`).then((r) => r.json()),
  });

  const jobDetail = useQuery<any>({
    queryKey: ["super-admin-job-detail", selectedJobId],
    enabled: !!selectedJobId,
    queryFn: () => fetch(`/api/super-admin/job-postings/${selectedJobId}`).then((r) => r.json()),
  });

  const columns: ColumnDef<HrRow>[] = [
    { accessorKey: "hrName", header: "HR Name" },
    { accessorKey: "companyName", header: "Company Name" },
    { accessorKey: "email", header: "Company Email" },
    { accessorKey: "designation", header: "Designation" },
    {
      accessorKey: "registrationDate",
      header: "Registration Date",
      cell: ({ row }) => formatDate(row.original.registrationDate),
    },
    {
      accessorKey: "verificationStatus",
      header: "Verification",
      cell: ({ row }) => <Badge variant="outline">{row.original.verificationStatus}</Badge>,
    },
    { accessorKey: "totalActiveJobs", header: "Total Active Jobs" },
    { accessorKey: "totalApplicationsReceived", header: "Total Applications Received" },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "destructive"}>
          {row.original.isActive ? "Enabled" : "Disabled"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => setSelectedHrId(row.original.id)}>
            View Details
          </Button>
          <Button
            size="sm"
            variant={row.original.isActive ? "destructive" : "secondary"}
            disabled={toggleStatus.isPending}
            onClick={() => toggleStatus.mutate({ id: row.original.id, isActive: !row.original.isActive })}
          >
            {row.original.isActive ? "Disable" : "Enable"}
          </Button>
        </div>
      ),
    },
  ];

  const chartMax = useMemo(() => {
    const values = [
      ...(details.data?.analytics?.jobsByMonth?.map((x: any) => x.count) ?? []),
      ...(details.data?.analytics?.applicationsByMonth?.map((x: any) => x.count) ?? []),
    ];
    return Math.max(...values, 1);
  }, [details.data]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">HR Management</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-sm"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          placeholder="Search HR, company, email..."
        />
        <p className="text-sm text-muted-foreground">
          Page {data?.page ?? 1} of {data?.totalPages ?? 1} ({data?.total ?? 0} records)
        </p>
      </div>
      {isLoading ? <div className="text-muted-foreground">Loading...</div> : null}
      <DataTable
        columns={columns}
        data={hrs}
        searchPlaceholder="Filter current page..."
        onRowClick={(row) => setSelectedHrId(row.id)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={(data?.page ?? 1) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={(data?.page ?? 1) >= (data?.totalPages ?? 1)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      <Dialog open={!!selectedHrId} onOpenChange={(open) => !open && setSelectedHrId(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>HR Account Monitoring</DialogTitle>
            <DialogDescription>Read-only analytics and monitoring view for Super Admin.</DialogDescription>
          </DialogHeader>

          {details.isLoading ? (
            <div className="space-y-3">
              <div className="h-8 w-64 animate-pulse rounded bg-muted" />
              <div className="grid gap-3 md:grid-cols-3">
                <div className="h-24 animate-pulse rounded bg-muted" />
                <div className="h-24 animate-pulse rounded bg-muted" />
                <div className="h-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-48 animate-pulse rounded bg-muted" />
            </div>
          ) : details.data ? (
            <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
              <Card>
                <CardHeader><CardTitle>Section 1: Company Information</CardTitle></CardHeader>
                <CardContent className="grid gap-2 md:grid-cols-2">
                  <p><strong>Company Name:</strong> {details.data.company.name}</p>
                  <p><strong>Company Email:</strong> {details.data.company.email}</p>
                  <p><strong>Company Website:</strong> {details.data.company.website || "-"}</p>
                  <p><strong>Verification Status:</strong> {details.data.company.verificationStatus}</p>
                  <p><strong>Registration Date:</strong> {formatDate(details.data.company.registrationDate)}</p>
                  <div className="flex items-center gap-2">
                    <strong>Company Logo:</strong>
                    {details.data.company.logoUrl ? (
                      <img src={details.data.company.logoUrl} alt="Company logo" className="h-10 w-10 rounded border border-border object-contain" />
                    ) : (
                      <span className="inline-block h-10 w-10 rounded border border-border bg-muted/30" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Section 2: HR Information</CardTitle></CardHeader>
                <CardContent className="grid gap-2 md:grid-cols-2">
                  <p><strong>HR Full Name:</strong> {details.data.profile.name}</p>
                  <p><strong>Designation:</strong> {details.data.profile.designation || "-"}</p>
                  <p><strong>Email Address:</strong> {details.data.profile.email}</p>
                  <p><strong>Account Status:</strong> {details.data.profile.isActive ? "Enabled" : "Disabled"}</p>
                  <p><strong>Last Login Date:</strong> {details.data.profile.lastLoginDate ? formatDate(details.data.profile.lastLoginDate) : "-"}</p>
                  <p><strong>Account Created Date:</strong> {formatDate(details.data.profile.accountCreatedDate)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Section 3: Recruitment Statistics</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  {[
                    ["Total Jobs Posted", details.data.recruitment.totalJobsPosted],
                    ["Active Jobs", details.data.recruitment.activeJobs],
                    ["Closed Jobs", details.data.recruitment.closedJobs],
                    ["Total Applications Received", details.data.recruitment.totalApplicationsReceived],
                    ["Pending Applications", details.data.recruitment.pendingApplications],
                    ["Shortlisted Applications", details.data.recruitment.shortlistedApplications],
                    ["Rejected Applications", details.data.recruitment.rejectedApplications],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded border border-border p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xl font-semibold">{String(value)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Section 4: Job Postings</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {details.data.jobs.map((job: any) => (
                    <button
                      key={job.id}
                      className="w-full rounded border border-border p-3 text-left hover:bg-muted/40"
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <p className="font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.employmentType} | Posted: {formatDate(job.postedDate)} | Last Date: {job.lastDate ? formatDate(job.lastDate) : "-"}
                      </p>
                      <p className="text-sm">Status: {job.status} | Total Applications: {job.totalApplications}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Section 5: Recent Applications</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {details.data.recentApplications.map((app: any) => (
                    <div key={app.id} className="rounded border border-border p-3">
                      <p className="font-medium">{app.studentName}</p>
                      <p className="text-sm text-muted-foreground">{app.collegeName} | {app.appliedJob}</p>
                      <p className="text-sm">Applied: {formatDate(app.appliedDate)} | Status: {app.status}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Section 6: Activity Timeline</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {details.data.timeline.map((log: any) => (
                    <div key={log.id} className="rounded border border-border p-3">
                      <p className="font-medium">{String(log.action).replaceAll("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)} {log.entity ? `| ${log.entity}` : ""}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Section 7: Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium">Jobs Created Over Time</p>
                    <div className="space-y-2">
                      {details.data.analytics.jobsByMonth.map((point: any) => (
                        <div key={`j-${point.month}`} className="flex items-center gap-2">
                          <span className="w-20 text-xs text-muted-foreground">{point.month}</span>
                          <div className="h-2 flex-1 rounded bg-muted">
                            <div className="h-2 rounded bg-cyan-500" style={{ width: `${(point.count / chartMax) * 100}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs">{point.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Applications Received Over Time</p>
                    <div className="space-y-2">
                      {details.data.analytics.applicationsByMonth.map((point: any) => (
                        <div key={`a-${point.month}`} className="flex items-center gap-2">
                          <span className="w-20 text-xs text-muted-foreground">{point.month}</span>
                          <div className="h-2 flex-1 rounded bg-muted">
                            <div className="h-2 rounded bg-violet-500" style={{ width: `${(point.count / chartMax) * 100}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs">{point.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Top Applied Jobs</p>
                    <div className="space-y-2">
                      {details.data.analytics.topAppliedJobs.map((row: any) => (
                        <div key={row.jobId} className="rounded border border-border p-2 text-sm">
                          {row.jobTitle} - {row.applicationsCount} applications
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-destructive">Unable to load HR details.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedJobId} onOpenChange={(open) => !open && setSelectedJobId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>Read-only job information.</DialogDescription>
          </DialogHeader>
          {jobDetail.isLoading ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : jobDetail.data ? (
            <div className="space-y-2">
              <p><strong>Title:</strong> {jobDetail.data.jobTitle}</p>
              <p><strong>Company:</strong> {jobDetail.data.companyName}</p>
              <p><strong>Employment Type:</strong> {jobDetail.data.employmentType}</p>
              <p><strong>Posted:</strong> {formatDate(jobDetail.data.postedDate)}</p>
              <p><strong>Last Date:</strong> {jobDetail.data.lastDateToApply ? formatDate(jobDetail.data.lastDateToApply) : "-"}</p>
              <p><strong>Status:</strong> {jobDetail.data.status}</p>
              <p><strong>Total Applications:</strong> {jobDetail.data.totalApplications}</p>
            </div>
          ) : (
            <p className="text-destructive">Unable to load job details.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

