"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { useEnrollmentsList } from "@/lib/hooks/useEnrollments";
import { formatDateTime } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

type Row = {
  id: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  courseType?: "live" | "record";
  orgName: string | null;
  accessType: string;
  status: string;
  completionPercentage: number;
  enrolledAt: string;
};

export default function SuperAdminEnrollmentsPage() {
  const [statusFilter, setStatusFilter] = useState("");

  const { data = [], isLoading } = useEnrollmentsList({
    status: statusFilter || undefined,
  });

  const columns: ColumnDef<Row>[] = [
    { accessorKey: "studentName", header: "Student" },
    { accessorKey: "courseTitle", header: "Course" },
    { accessorKey: "orgName", header: "Org", cell: ({ row }) => row.original.orgName ?? "Direct" },
    {
      accessorKey: "accessType",
      header: "Type",
      cell: ({ row }) => {
        const isLive = row.original.courseType === "live" || row.original.accessType?.toLowerCase() === "live";
        const isBoth = row.original.accessType?.toLowerCase() === "both";
        const label = isBoth ? "BOTH" : isLive ? "LIVE" : "RECORDED";
        return (
          <Badge
            variant="outline"
            className={
              isLive
                ? "bg-swiss-red/15 text-swiss-red border-swiss-red/30 font-semibold"
                : isBoth
                ? "bg-violet-500/15 text-violet-700 border-violet-500/30 font-semibold"
                : "bg-amber-500/15 text-amber-700 border-amber-500/30 font-semibold"
            }
          >
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      accessorKey: "completionPercentage",
      header: "Progress",
      cell: ({ row }) => `${row.original.completionPercentage}%`,
    },
    {
      accessorKey: "enrolledAt",
      header: "Enrolled",
      cell: ({ row }) =>
        row.original.enrolledAt ? formatDateTime(row.original.enrolledAt) : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrollments"
        description="All student course enrollments across the platform."
      />

      <div className="flex gap-2 flex-wrap">
        {["", "active", "paused", "revoked", "completed"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${
              statusFilter === s
                ? "bg-swiss-red text-white border-swiss-red"
                : "border-swiss-black/15 text-swiss-muted"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-swiss-muted">Loading…</p>
      ) : (
        <DataTable columns={columns} data={data as Row[]} searchPlaceholder="Search…" />
      )}
    </div>
  );
}
