"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export default function HrPreviousJobsPage() {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["hr-jobs-previous"],
    queryFn: () => fetch("/api/hr/jobs/previous").then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Previous Job Postings</h1>
      <Card>
        <CardHeader><CardTitle>Closed / Archived Jobs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : jobs.length === 0 ? (
            <p className="text-muted-foreground">No previous jobs.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job: any) => (
                <div key={job.id} className="rounded border p-3">
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Created: {formatDateTime(job.createdAt)} · Closed: {formatDateTime(job.closedAt)}
                  </p>
                  <p className="text-sm">Applications: {job.totalApplications ?? 0}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

