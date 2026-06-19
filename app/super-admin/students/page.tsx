"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, ChevronDown } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddDirectStudentModal } from "@/components/modals/AddDirectStudentModal";
import { EditStudentModal } from "@/components/modals/EditStudentModal";
import { SelectStudentForAssignModal } from "@/components/modals/SelectStudentForAssignModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  courseTitles?: string[];
  courseId: string;
  batchName: string;
  isActive: boolean;
  enrollmentId?: string | null;
};

type OrganisationOption = { id: string; name: string };

function StudentCoursesCell({
  courseTitles,
  courseTitle,
}: {
  courseTitles?: string[];
  courseTitle: string;
}) {
  const titles =
    courseTitles && courseTitles.length > 0
      ? courseTitles
      : courseTitle && courseTitle !== "—"
        ? [courseTitle]
        : [];

  if (titles.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (titles.length === 1) {
    return <span className="text-sm">{titles[0]}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-swiss-red hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {titles.length} courses
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[240px]">
        {titles.map((title) => (
          <DropdownMenuItem key={title} onSelect={(e) => e.preventDefault()} className="text-sm">
            {title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function StudentsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | undefined>();
  const [organisationFilter, setOrganisationFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: organisations = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["organisations"],
    queryFn: async () => {
      const res = await fetch("/api/organisations");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["students", organisationFilter],
    queryFn: async ({ pageParam = "" }) => {
      const params = new URLSearchParams({ cursor: String(pageParam), limit: "50" });
      if (organisationFilter !== "all") {
        params.set("organisationId", organisationFilter);
      }
      const res = await fetch(`/api/students?${params}`);
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
          return <Badge className="bg-swiss-red/15 text-swiss-red border-swiss-red/30">Direct</Badge>;
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
      cell: ({ row }) => (
        <StudentCoursesCell
          courseTitles={row.original.courseTitles}
          courseTitle={row.original.courseTitle}
        />
      ),
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
            {!row.original.organisationId && (
              <DropdownMenuItem asChild>
                <Link href={`/super-admin/students/${row.original.id}/courses`}>Assign courses</Link>
              </DropdownMenuItem>
            )}
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAssignOpen(true)}>
            Assign Course
          </Button>
          <Button onClick={() => setAddOpen(true)}>+ Add Student</Button>
        </div>
      </div>

      <SelectStudentForAssignModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        assignBasePath="/super-admin/students"
        directStudentsOnly
        title="Assign courses to direct student"
        description="Only direct students (not linked to an organisation) can receive courses from super admin. Organisation students are managed by their org admin."
      />

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
        <div className="space-y-2 sm:min-w-[280px]">
          <Label htmlFor="org-filter">Organisation</Label>
          <Select value={organisationFilter} onValueChange={setOrganisationFilter}>
            <SelectTrigger id="org-filter">
              <SelectValue placeholder="All students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              <SelectItem value="direct">Direct (no organisation)</SelectItem>
              {organisations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {organisationFilter !== "all" && (
          <p className="text-sm text-muted-foreground pb-2">
            {organisationFilter === "direct"
              ? "Showing students enrolled directly by super admin."
              : `Showing students for ${organisations.find((o) => o.id === organisationFilter)?.name ?? "selected organisation"}.`}
          </p>
        )}
      </div>

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
