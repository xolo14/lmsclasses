"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

type ApplicationStatus = "pending" | "shortlisted" | "rejected";

type StudentApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  organisationName: string;
  location: string | null;
  employmentType: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
};

function statusBadgeVariant(status: ApplicationStatus) {
  if (status === "shortlisted") return "success" as const;
  if (status === "rejected") return "destructive" as const;
  return "warning" as const;
}

function statusLabel(status: ApplicationStatus) {
  if (status === "shortlisted") return "Shortlisted";
  if (status === "rejected") return "Rejected";
  return "Under review";
}

function statusMessage(status: ApplicationStatus) {
  if (status === "shortlisted") {
    return "Congratulations! The HR team has shortlisted your application.";
  }
  if (status === "rejected") {
    return "This application was not selected. You may apply to other openings.";
  }
  return "Your application is with HR. You will see an update here when they respond.";
}

export default function StudentApplicationsPage() {
  const { data: applications = [], isLoading } = useQuery<StudentApplication[]>({
    queryKey: ["student-applications"],
    queryFn: () => fetch("/api/student/job-applications").then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">My Applications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track jobs you applied for and HR responses (shortlisted or rejected).
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading applications...</p>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>You have not applied to any jobs yet.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/student/job-portal">Browse Job Portal</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{app.jobTitle}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {app.organisationName}
                      {app.location ? ` · ${app.location}` : ""}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(app.status)} className="w-fit shrink-0">
                    {statusLabel(app.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{statusMessage(app.status)}</p>
                <p className="text-xs text-muted-foreground">
                  Applied {formatDateTime(app.appliedAt)}
                  {app.status !== "pending" && app.updatedAt
                    ? ` · Updated ${formatDateTime(app.updatedAt)}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {app.employmentType.replace("_", " ")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
