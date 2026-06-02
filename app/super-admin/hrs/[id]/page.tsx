"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type HrDetail = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  logoUrl: string | null;
  isActive: boolean;
  registrationDate: string;
  companyName: string;
  companyDomain: string;
  companyWebsite: string | null;
  verificationStatus: string;
  totalJobsPosted: number;
  totalApplications: number;
  recentJobs: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    applicationDeadline: string;
    applicationsCount: number;
  }>;
};

export default function SuperAdminHrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { data, isLoading } = useQuery<HrDetail>({
    queryKey: ["super-admin-hr-detail", id],
    enabled: !!id,
    queryFn: () => fetch(`/api/super-admin/hrs/${id}`).then((r) => r.json()),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!data?.id) return <p className="text-destructive">HR not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">HR Details</h1>
        <Button asChild variant="outline">
          <Link href="/super-admin/hrs">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <p><strong>Name:</strong> {data.name}</p>
          <p><strong>Email:</strong> {data.email}</p>
          <p><strong>Designation:</strong> {data.designation || "-"}</p>
          <p><strong>Registered:</strong> {formatDate(data.registrationDate)}</p>
          <p><strong>Status:</strong> <Badge variant={data.isActive ? "success" : "destructive"}>{data.isActive ? "Enabled" : "Disabled"}</Badge></p>
          <p><strong>Verification:</strong> <Badge variant="outline">{data.verificationStatus}</Badge></p>
          <p><strong>Total Jobs:</strong> {data.totalJobsPosted}</p>
          <p><strong>Total Applications:</strong> {data.totalApplications}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <p><strong>Name:</strong> {data.companyName}</p>
          <p><strong>Domain:</strong> {data.companyDomain}</p>
          <p><strong>Website:</strong> {data.companyWebsite || "-"}</p>
          <div className="flex items-center gap-2">
            <strong>Logo:</strong>
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="Company logo" className="h-10 w-10 rounded border border-border object-contain" />
            ) : (
              <span className="inline-block h-10 w-10 rounded border border-border bg-muted/30" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Job Postings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentJobs.length === 0 ? (
            <p className="text-muted-foreground">No jobs posted yet.</p>
          ) : (
            data.recentJobs.map((job) => (
              <div key={job.id} className="rounded border border-border p-3">
                <p className="font-medium">{job.title}</p>
                <p className="text-sm text-muted-foreground">
                  Posted: {formatDate(job.createdAt)} | Deadline: {formatDate(job.applicationDeadline)}
                </p>
                <p className="text-sm">
                  Applications: {job.applicationsCount} | Status: {job.status}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
