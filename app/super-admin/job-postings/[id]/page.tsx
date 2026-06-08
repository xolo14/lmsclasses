"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function SuperAdminJobPostingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: job, isLoading } = useQuery({
    queryKey: ["super-admin-job-posting", id],
    queryFn: () => fetch(`/api/super-admin/job-postings/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!job?.id) return <div className="text-muted-foreground">Job posting not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{job.jobTitle}</h1>
        <Badge variant="outline">{job.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Company Name</p>
            <p className="font-medium">{job.companyName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Company Email</p>
            <p className="font-medium">{job.companyEmail || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Company Website</p>
            <p className="font-medium">{job.companyWebsite || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Verification Status</p>
            <p className="font-medium">{job.companyVerificationStatus}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground mb-2">Organization Logo</p>
            {job.organizationLogo ? (
              <img
                src={job.organizationLogo}
                alt={`${job.companyName} logo`}
                className="h-16 w-16 rounded border border-border bg-muted/30 object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No logo uploaded</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>HR Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">HR Name</p>
            <p className="font-medium">{job.hrName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">HR Email</p>
            <p className="font-medium">{job.hrEmail}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Designation</p>
            <p className="font-medium">{job.hrDesignation || "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p><span className="text-muted-foreground">Job Title:</span> {job.jobTitle}</p>
          <p><span className="text-muted-foreground">Description:</span> {job.description}</p>
          <p><span className="text-muted-foreground">Responsibilities:</span> {job.responsibilities || "—"}</p>
          <p><span className="text-muted-foreground">Experience:</span> {job.experience || "—"}</p>
          <p>
            <span className="text-muted-foreground">
              {job.employmentType === "internship"
                ? "Stipend:"
                : job.employmentType === "part_time"
                ? "Salary per Month:"
                : "CTC:"}
            </span>{" "}
            {job.employmentType === "internship"
              ? job.stipend || "—"
              : job.employmentType === "part_time"
              ? job.salary || "—"
              : job.ctc || "—"}
          </p>
          <p><span className="text-muted-foreground">Employment Type:</span> {job.employmentType?.replaceAll("_", " ")}</p>
          <p><span className="text-muted-foreground">Posted Date:</span> {formatDateTime(job.postedDate)}</p>
          <p><span className="text-muted-foreground">Last Date to Apply:</span> {formatDateTime(job.applicationDeadline)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Application Summary</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><p className="text-sm text-muted-foreground">Total Applications</p><p className="text-2xl font-bold">{job.totalApplications ?? 0}</p></div>
          <div><p className="text-sm text-muted-foreground">Pending Applications</p><p className="text-2xl font-bold">{job.pendingApplications ?? 0}</p></div>
          <div><p className="text-sm text-muted-foreground">Shortlisted Applications</p><p className="text-2xl font-bold">{job.shortlistedApplications ?? 0}</p></div>
          <div><p className="text-sm text-muted-foreground">Rejected Applications</p><p className="text-2xl font-bold">{job.rejectedApplications ?? 0}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}

