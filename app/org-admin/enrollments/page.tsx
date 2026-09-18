"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Pause, Play, XCircle } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type EnrollmentRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string | null;
  courseType: "live" | "record";
  status: string;
  batchId: string | null;
  liveAccessUntil: string | null;
  recordedAccessUntil: string | null;
  enrolledAt: string | null;
};

export default function OrgAdminEnrollmentsPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState("");

  const { data, isLoading } = useQuery<{ data: EnrollmentRow[] }>({
    queryKey: ["org-enrollments"],
    queryFn: async () => {
      const res = await fetch("/api/enrollments?limit=500");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load enrollments");
      return json;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" | "revoked" }) => {
      const res = await fetch(`/api/enrollments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update enrollment");
    },
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: ["org-enrollments"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const columns: ColumnDef<EnrollmentRow>[] = [
    {
      accessorKey: "studentName",
      header: "Student",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.original.studentEmail}</p>
        </div>
      ),
    },
    { accessorKey: "courseTitle", header: "Course" },
    {
      accessorKey: "courseType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.courseType === "live" ? "Live" : "Recorded"}</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge>{row.original.status}</Badge>,
    },
    {
      id: "accessUntil",
      header: "Access until",
      cell: ({ row }) => {
        const until =
          row.original.courseType === "live"
            ? row.original.liveAccessUntil
            : row.original.recordedAccessUntil;
        return until ? formatDate(until) : "—";
      },
    },
    {
      accessorKey: "enrolledAt",
      header: "Enrolled",
      cell: ({ row }) => (row.original.enrolledAt ? formatDate(row.original.enrolledAt) : "—"),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <div className="flex gap-1">
            {status === "active" && (
              <Button
                size="sm"
                variant="outline"
                disabled={updateStatus.isPending}
                onClick={() => {
                  if (confirm(`Pause access for ${row.original.studentName}?`)) {
                    updateStatus.mutate({ id: row.original.id, status: "paused" });
                  }
                }}
              >
                <Pause className="h-3 w-3" />
              </Button>
            )}
            {(status === "paused" || status === "revoked") && (
              <Button
                size="sm"
                variant="outline"
                disabled={updateStatus.isPending}
                onClick={() => {
                  if (confirm(`Resume access for ${row.original.studentName}?`)) {
                    updateStatus.mutate({ id: row.original.id, status: "active" });
                  }
                }}
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
            {status !== "revoked" && (
              <Button
                size="sm"
                variant="destructive"
                disabled={updateStatus.isPending}
                onClick={() => {
                  if (confirm(`Revoke ${row.original.studentName}'s enrollment? This frees the seat.`)) {
                    updateStatus.mutate({ id: row.original.id, status: "revoked" });
                  }
                }}
              >
                <XCircle className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading enrollments...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enrollments</h1>
        <p className="text-sm text-muted-foreground">Pause, resume, or revoke your organisation&apos;s student enrollments.</p>
      </div>
      {actionError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchPlaceholder="Search students or courses..."
      />
    </div>
  );
}
