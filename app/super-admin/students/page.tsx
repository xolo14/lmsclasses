"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddDirectStudentModal } from "@/components/modals/AddDirectStudentModal";
import { EditStudentModal } from "@/components/modals/EditStudentModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Student = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  collegeName?: string | null;
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
  const [editStudent, setEditStudent] = useState<Student | undefined>();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["students"],
    queryFn: async ({ pageParam = "" }) => {
      const res = await fetch(`/api/students?cursor=${pageParam}&limit=50`);
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(typeof resData?.error === "string" ? resData.error : "Failed to load students");
      }
      return resData;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? undefined,
  });

  const students = data ? data.pages.flatMap((page) => page.data) : [];

  const deleteStudent = useMutation({
    mutationFn: (id: string) => fetch(`/api/students/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
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
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditStudent(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toggleActive.mutate({ id: row.original.id, isActive: row.original.isActive })
              }
            >
              {row.original.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (confirm(`Move "${row.original.name}" to trash?`)) {
                  deleteStudent.mutate(row.original.id);
                }
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

      <EditStudentModal
        open={!!editStudent}
        onOpenChange={(open) => !open && setEditStudent(undefined)}
        student={editStudent}
        showStatus
      />

      <DataTable
        columns={columns}
        data={students}
        searchPlaceholder="Search students..."
        searchKey="name"
        getRowId={(row) => row.id}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  );
}
