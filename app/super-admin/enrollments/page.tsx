"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, MoreHorizontal, UserPlus } from "lucide-react";
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
import { fetchAllStudents } from "@/lib/students-client";
import { formatDateTime } from "@/lib/utils";

type OrganisationOption = { id: string; name: string };
type CourseOption = { id: string; title: string; kind: "live" | "record" };

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
  isActive: boolean;
};

type EnrollmentApiRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  lmsId?: string | null;
  phone?: string | null;
  collegeName?: string | null;
  isActive?: boolean | null;
  organisationId?: string | null;
  enrollmentSource?: string | null;
  orgName: string | null;
  courseTitle: string | null;
  courseType?: "live" | "record";
  accessType?: string;
  status: string;
  completionPercentage?: number | null;
  enrolledAt?: string | null;
  batchName?: string | null;
};

type CombinedRow = {
  rowId: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string | null;
  collegeName?: string | null;
  lmsId: string;
  orgName: string | null;
  organisationId?: string | null;
  source?: string | null;
  isActive: boolean;
  enrollmentId?: string | null;
  courseTitle: string;
  courseType?: "live" | "record";
  accessType?: string;
  enrollmentStatus?: string;
  completionPercentage?: number;
  enrolledAt?: string | null;
  batchName: string;
};

function sourceLabel(src?: string | null, orgName?: string | null) {
  if (src === "super_admin") {
    return <Badge className="bg-swiss-red/15 text-swiss-red border-swiss-red/30">Direct</Badge>;
  }
  if (src === "public") {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Self Enrolled</Badge>;
  }
  if (src === "org_admin" || orgName) {
    return orgName || "Organisation";
  }
  return "—";
}

function typeBadge(row: CombinedRow) {
  if (!row.enrollmentId) return <span className="text-muted-foreground">—</span>;
  const isLive = row.courseType === "live" || row.accessType?.toLowerCase() === "live";
  const isBoth = row.accessType?.toLowerCase() === "both";
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
}

function fromEnrollment(e: EnrollmentApiRow): CombinedRow {
  return {
    rowId: e.id,
    studentId: e.studentId,
    name: e.studentName,
    email: e.studentEmail,
    phone: e.phone,
    collegeName: e.collegeName,
    lmsId: e.lmsId || "—",
    orgName: e.orgName,
    organisationId: e.organisationId,
    source: e.enrollmentSource,
    isActive: e.isActive !== false,
    enrollmentId: e.id,
    courseTitle: e.courseTitle || "—",
    courseType: e.courseType,
    accessType: e.accessType,
    enrollmentStatus: e.status,
    completionPercentage: e.completionPercentage ?? 0,
    enrolledAt: e.enrolledAt,
    batchName: e.batchName || "—",
  };
}

function fromUnenrolledStudent(s: Student): CombinedRow {
  return {
    rowId: `student:${s.id}`,
    studentId: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    collegeName: s.collegeName,
    lmsId: s.lmsId,
    orgName: s.orgName || null,
    organisationId: s.organisationId,
    source: s.enrollmentSource ?? s.source,
    isActive: s.isActive,
    enrollmentId: null,
    courseTitle: "—",
    enrollmentStatus: undefined,
    completionPercentage: undefined,
    enrolledAt: null,
    batchName: "—",
  };
}

export default function SuperAdminEnrollmentsPage() {
  const queryClient = useQueryClient();
  const [editStudent, setEditStudent] = useState<Student | undefined>();
  const [organisationFilter, setOrganisationFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: organisations = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["organisations"],
    queryFn: async () => {
      const res = await fetch("/api/organisations");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: courses = [] } = useQuery<CourseOption[]>({
    queryKey: ["enrollment-course-options"],
    queryFn: async () => {
      const [liveRes, recordRes] = await Promise.all([
        fetch("/api/live-courses"),
        fetch("/api/record-courses"),
      ]);
      const [liveData, recordData] = await Promise.all([liveRes.json(), recordRes.json()]);
      const liveOpts = (Array.isArray(liveData) ? liveData : []).map((c: { id: string; title: string }) => ({
        id: c.id,
        title: c.title,
        kind: "live" as const,
      }));
      const recordOpts = (Array.isArray(recordData) ? recordData : []).map((c: { id: string; title: string }) => ({
        id: c.id,
        title: c.title,
        kind: "record" as const,
      }));
      return [...liveOpts, ...recordOpts].sort((a, b) => a.title.localeCompare(b.title));
    },
  });

  const {
    data: enrollments = [],
    isLoading: enrollmentsLoading,
    isError: enrollmentsError,
    error: enrollmentsErr,
  } = useQuery<EnrollmentApiRow[]>({
    queryKey: ["enrollments-list", organisationFilter, courseFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "500" });
      if (organisationFilter !== "all") params.set("orgId", organisationFilter);
      if (courseFilter !== "all") params.set("courseId", courseFilter);
      if (typeFilter) params.set("courseType", typeFilter);
      const res = await fetch(`/api/enrollments?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load enrollments");
      return (json.data ?? []) as EnrollmentApiRow[];
    },
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["students", organisationFilter],
    queryFn: () =>
      fetchAllStudents({
        organisationId: organisationFilter === "all" ? undefined : organisationFilter,
      }),
    enabled: !typeFilter && courseFilter === "all",
  });

  const rows = useMemo(() => {
    const enrolled = enrollments.map(fromEnrollment);
    if (typeFilter || courseFilter !== "all") return enrolled;
    const enrolledIds = new Set(enrollments.map((e) => e.studentId));
    const extras = students
      .filter((s) => !enrolledIds.has(s.id))
      .map(fromUnenrolledStudent);
    return [...enrolled, ...extras];
  }, [enrollments, students, typeFilter, courseFilter]);

  const deleteStudent = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete student");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments-list"] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update student");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments-list"] });
    },
  });

  const columns: ColumnDef<CombinedRow>[] = [
    { accessorKey: "name", header: "Student Name" },
    { accessorKey: "lmsId", header: "LMS ID" },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => sourceLabel(row.original.source, row.original.orgName),
    },
    {
      accessorKey: "orgName",
      header: "Organisation",
      cell: ({ row }) => row.original.orgName || "Direct",
    },
    {
      accessorKey: "courseTitle",
      header: "Course",
      cell: ({ row }) =>
        row.original.enrollmentId ? (
          <span className="text-sm font-medium">{row.original.courseTitle}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "accessType",
      header: "Type",
      cell: ({ row }) => typeBadge(row.original),
    },
    {
      accessorKey: "batchName",
      header: "Batch",
      cell: ({ row }) => row.original.batchName || "—",
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.enrollmentStatus ? (
          <Badge variant="outline">{row.original.enrollmentStatus}</Badge>
        ) : (
          <Badge variant={row.original.isActive ? "success" : "destructive"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
    },
    {
      accessorKey: "completionPercentage",
      header: "Progress",
      cell: ({ row }) => {
        if (!row.original.enrollmentId) {
          return <span className="text-muted-foreground">—</span>;
        }
        const pct = row.original.completionPercentage ?? 0;
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="h-1.5 flex-1 bg-swiss-black/10 rounded-full overflow-hidden">
              <div className="h-full bg-swiss-red" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums">{pct}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "enrolledAt",
      header: "Enrolled",
      cell: ({ row }) =>
        row.original.enrolledAt ? formatDateTime(row.original.enrolledAt) : "—",
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
                <Link href={`/super-admin/students/${row.original.studentId}/courses`}>
                  Assign courses
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                setEditStudent({
                  id: row.original.studentId,
                  name: row.original.name,
                  email: row.original.email,
                  phone: row.original.phone,
                  collegeName: row.original.collegeName,
                  lmsId: row.original.lmsId,
                  orgName: row.original.orgName || "",
                  organisationId: row.original.organisationId,
                  courseTitle: row.original.courseTitle,
                  isActive: row.original.isActive,
                })
              }
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toggleActive.mutate({
                  id: row.original.studentId,
                  isActive: row.original.isActive,
                })
              }
            >
              {row.original.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (confirm(`Move "${row.original.name}" to trash?`)) {
                  deleteStudent.mutate(row.original.studentId);
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

  const isLoading = enrollmentsLoading || (!typeFilter && studentsLoading);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrollment"
        description="Students and course enrollments in one table. One row per student per course."
      >
        <Button variant="outline" onClick={() => setAssignOpen(true)}>
          <BookOpen className="h-4 w-4 mr-1.5" />
          Assign Course
        </Button>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add Student
        </Button>
      </PageHeader>

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
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["students"] });
          queryClient.invalidateQueries({ queryKey: ["enrollments-list"] });
        }}
      />

      <EditStudentModal
        open={!!editStudent}
        onOpenChange={(open) => !open && setEditStudent(undefined)}
        student={editStudent}
        showStatus
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1 sm:min-w-[280px]">
          <Label htmlFor="org-filter" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Filter by Organisation
          </Label>
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

        <div className="space-y-1 sm:min-w-[280px]">
          <Label htmlFor="course-filter" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Filter by Course
          </Label>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger id="course-filter">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title} ({course.kind === "live" ? "Live" : "Recorded"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mr-1">
            Type:
          </span>
          {([
            { value: "", label: "All" },
            { value: "live", label: "Live" },
            { value: "record", label: "Record" },
          ] as const).map((s) => (
            <button
              key={s.value || "all"}
              type="button"
              onClick={() => setTypeFilter(s.value)}
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border rounded-sm transition-colors ${
                typeFilter === s.value
                  ? "bg-swiss-red text-white border-swiss-red"
                  : "border-swiss-black/15 text-swiss-muted hover:border-swiss-black/30"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {(organisationFilter !== "all" || courseFilter !== "all") && (
        <p className="text-xs text-muted-foreground">
          {[
            organisationFilter === "direct"
              ? "Showing students enrolled directly by super admin"
              : organisationFilter !== "all"
                ? `Showing students for ${organisations.find((o) => o.id === organisationFilter)?.name ?? "selected organisation"}`
                : null,
            courseFilter !== "all"
              ? `in ${courses.find((c) => c.id === courseFilter)?.title ?? "selected course"}`
              : null,
          ]
            .filter(Boolean)
            .join(" ")}
          .
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8">Loading enrollment…</p>
      ) : enrollmentsError ? (
        <p className="text-sm text-destructive py-4">
          Could not load enrollment: {enrollmentsErr instanceof Error ? enrollmentsErr.message : "Unknown error"}
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search by student, course, LMS ID, or organisation…"
          getRowId={(row) => row.rowId}
        />
      )}
    </div>
  );
}
