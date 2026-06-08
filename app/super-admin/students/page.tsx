"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";

type Student = {
  id: string;
  name: string;
  email: string;
  lmsId: string;
  orgName: string;
  courseTitle: string;
  courseId: string;
  batchName: string;
  isActive: boolean;
  enrollmentId?: string | null;
};

export default function StudentsPage() {
  const {
    data: students = [],
    isLoading,
    isError,
    error,
  } = useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: async () => {
      const res = await fetch("/api/students");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to load students");
      }
      return Array.isArray(data) ? data : [];
    },
  });

  const columns: ColumnDef<Student>[] = [
    { accessorKey: "name", header: "Student Name" },
    { accessorKey: "lmsId", header: "LMS ID" },
    {
      accessorKey: "orgName",
      header: "Organisation",
      cell: ({ row }) => row.original.orgName || "—",
    },
    {
      accessorKey: "courseTitle",
      header: "Course",
      cell: ({ row }) => row.original.courseTitle || "—",
    },
    {
      accessorKey: "batchName",
      header: "Batch",
      cell: ({ row }) => row.original.batchName || "—",
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "destructive"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  if (isError) {
    return (
      <div className="text-destructive">
        Could not load students: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Students" />

      <DataTable
        columns={columns}
        data={students}
        searchPlaceholder="Search students..."
        searchKey="name"
        getRowId={(row) => `${row.id}-${row.enrollmentId ?? "none"}`}
      />
    </div>
  );
}
