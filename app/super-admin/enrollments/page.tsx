"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  GraduationCap,
  Layers,
  MoreHorizontal,
  ChevronDown,
  UserPlus,
  BookOpen,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useEnrollmentsList } from "@/lib/hooks/useEnrollments";
import { formatDateTime } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

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

type EnrollmentRow = {
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

/* ------------------------------------------------------------------ */
/* Student Courses Cell Component                                     */
/* ------------------------------------------------------------------ */

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
    return <span className="text-sm font-medium">{titles[0]}</span>;
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

/* ------------------------------------------------------------------ */
/* Students Tab Component                                             */
/* ------------------------------------------------------------------ */

function StudentsTabSection({
  onAddStudentClick,
  onAssignCourseClick,
}: {
  onAddStudentClick: () => void;
  onAssignCourseClick: () => void;
}) {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments-list"] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments-list"] });
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

  return (
    <div className="space-y-4">
      <EditStudentModal
        open={!!editStudent}
        onOpenChange={(open) => !open && setEditStudent(undefined)}
        student={editStudent}
        showStatus
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onAssignCourseClick}>
            <BookOpen className="h-4 w-4 mr-1.5" />
            Assign Course
          </Button>
          <Button onClick={onAddStudentClick}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add Student
          </Button>
        </div>
      </div>

      {organisationFilter !== "all" && (
        <p className="text-xs text-muted-foreground">
          {organisationFilter === "direct"
            ? "Showing students enrolled directly by super admin."
            : `Showing students for ${organisations.find((o) => o.id === organisationFilter)?.name ?? "selected organisation"}.`}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8">Loading students…</p>
      ) : isError ? (
        <p className="text-sm text-destructive py-4">
          Could not load students: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={students}
          searchPlaceholder="Search students by name..."
          searchKey="name"
          getRowId={(row) => row.id}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Course Enrollments Tab Component                                   */
/* ------------------------------------------------------------------ */

function CourseEnrollmentsTabSection() {
  const [statusFilter, setStatusFilter] = useState("");

  const { data = [], isLoading } = useEnrollmentsList({
    status: statusFilter || undefined,
  });

  const columns: ColumnDef<EnrollmentRow>[] = [
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
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="h-1.5 flex-1 bg-swiss-black/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-swiss-red"
              style={{ width: `${row.original.completionPercentage}%` }}
            />
          </div>
          <span className="text-xs tabular-nums">{row.original.completionPercentage}%</span>
        </div>
      ),
    },
    {
      accessorKey: "enrolledAt",
      header: "Enrolled",
      cell: ({ row }) =>
        row.original.enrolledAt ? formatDateTime(row.original.enrolledAt) : "—",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mr-1">
          Status:
        </span>
        {["", "active", "paused", "revoked", "completed"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border rounded-sm transition-colors ${
              statusFilter === s
                ? "bg-swiss-red text-white border-swiss-red"
                : "border-swiss-black/15 text-swiss-muted hover:border-swiss-black/30"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-swiss-muted py-8">Loading enrollments…</p>
      ) : (
        <DataTable
          columns={columns}
          data={data as EnrollmentRow[]}
          searchPlaceholder="Search enrollments by student, course, or org…"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Enrollment Page                                               */
/* ------------------------------------------------------------------ */

function EnrollmentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const tabParam = searchParams.get("tab") as "students" | "enrollments" | null;
  const [activeTab, setActiveTab] = useState<string>(tabParam || "students");

  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    if (tabParam && (tabParam === "students" || tabParam === "enrollments")) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", val);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrollment"
        description="Unified hub for student directory, direct admissions, and course enrollments."
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="bg-swiss-cream/70 border border-swiss-black/10 p-1">
          <TabsTrigger value="students" className="gap-2 px-4 py-2 text-sm">
            <GraduationCap className="h-4 w-4" />
            Students
          </TabsTrigger>
          <TabsTrigger value="enrollments" className="gap-2 px-4 py-2 text-sm">
            <Layers className="h-4 w-4" />
            Course Enrollments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-0">
          <StudentsTabSection
            onAddStudentClick={() => setAddOpen(true)}
            onAssignCourseClick={() => setAssignOpen(true)}
          />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-0">
          <CourseEnrollmentsTabSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SuperAdminEnrollmentsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-6">Loading Enrollment hub…</div>}>
      <EnrollmentContent />
    </Suspense>
  );
}
