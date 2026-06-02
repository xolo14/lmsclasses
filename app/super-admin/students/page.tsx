"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddStudentModal } from "@/components/modals/AddStudentModal";
import { EditStudentModal } from "@/components/modals/EditStudentModal";
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
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | undefined>();

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

  const deleteStudent = useMutation({
    mutationFn: (id: string) => fetch(`/api/students/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
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
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditStudent(row.original)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Move "${row.original.name}" to trash?`)) {
                deleteStudent.mutate(row.original.id);
              }
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
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
      <PageHeader title="Students">
        <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Add Student
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={students}
        searchPlaceholder="Search students..."
        searchKey="name"
        getRowId={(row) => `${row.id}-${row.enrollmentId ?? "none"}`}
      />

      <AddStudentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        requireOrganisation
        showCourseSelect
      />
      <EditStudentModal
        open={!!editStudent}
        onOpenChange={(o) => !o && setEditStudent(undefined)}
        student={editStudent}
      />
    </div>
  );
}
