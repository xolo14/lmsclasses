"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddDirectStudentModal } from "@/components/modals/AddDirectStudentModal";

type Student = {
  id: string;
  name: string;
  email: string;
  lmsId: string;
  orgName: string;
  source?: string;
  enrollmentSource?: string;
  organisationId?: string | null;
  courseTitle: string;
  courseId: string;
  batchName: string;
  isActive: boolean;
  enrollmentId?: string | null;
};

export default function StudentsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();

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
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => {
        const src = row.original.enrollmentSource ?? row.original.source;
        if (src === "super_admin") {
          return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Direct</Badge>;
        }
        if (src === "public") {
          return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Self Enrolled</Badge>;
        }
        if (src === "org_admin" || row.original.orgName) {
          return row.original.orgName || "Organisation";
        }
        return "—";
      },
    },
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Students" />
        <Button onClick={() => setAddOpen(true)}>+ Add Student</Button>
      </div>

      <AddDirectStudentModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["students"] })}
      />

      <DataTable
        columns={columns}
        data={students}
        searchPlaceholder="Search students..."
        searchKey="name"
        getRowId={(row) => row.id}
      />
    </div>
  );
}
