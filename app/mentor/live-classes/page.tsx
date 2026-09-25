"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { Circle, Copy, ExternalLink, Play, Plus } from "lucide-react";
import { AddMentorLiveClassModal } from "@/components/modals/AddMentorLiveClassModal";
import { WatchRecordingModal } from "@/components/modals/WatchRecordingModal";
import { openMeetPopup } from "@/lib/live-class-recorder";

type LiveClass = {
  id: string;
  title: string;
  courseTitle: string;
  batchName: string;
  scheduledAt: string;
  duration: number;
  meetingLink: string | null;
  recordingUrl?: string | null;
  status: string;
};

type MentorCourseResponse = {
  course: {
    id: string;
    title: string;
  } | null;
  courses?: { id: string; title: string }[];
};

function statusBadge(status: string) {
  if (status === "live") return <Badge variant="success">live</Badge>;
  if (status === "scheduled") return <Badge variant="warning">scheduled</Badge>;
  if (status === "completed") return <Badge variant="outline">completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function MentorLiveClassesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [watchRecording, setWatchRecording] = useState<{ url: string; title: string } | null>(null);

  const { data: courseData } = useQuery<MentorCourseResponse>({
    queryKey: ["mentor-course"],
    queryFn: () => fetch("/api/mentor/course").then((r) => r.json()),
  });

  const { data: activeClasses = [], isLoading: loadingActive } = useQuery<LiveClass[]>({
    queryKey: ["live-classes", "mentor", "active"],
    queryFn: async () => {
      const res = await fetch("/api/live-classes/mentor?tab=active");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: completedClasses = [], isLoading: loadingCompleted } = useQuery<LiveClass[]>({
    queryKey: ["live-classes", "mentor", "completed"],
    queryFn: async () => {
      const res = await fetch("/api/live-classes/mentor?tab=completed");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const assignedCourses = courseData?.courses?.length
    ? courseData.courses
    : courseData?.course
      ? [courseData.course]
      : [];
  const assignedCourse = assignedCourses[0];

  const openStudio = (row: LiveClass) => {
    if (row.meetingLink) {
      const popup = openMeetPopup(row.meetingLink, row.id);
      if (!popup) window.open(row.meetingLink, "_blank", "noopener,noreferrer");
    }
    router.push(`/mentor/live-classes/${row.id}/studio`);
  };

  const actionCell = (row: LiveClass, opts?: { showWatch?: boolean }) => (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" onClick={() => openStudio(row)}>
        <ExternalLink className="h-3 w-3 mr-1" /> Join
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/mentor/live-classes/${row.id}/studio`}>
          <Circle className="h-3 w-3 mr-1 fill-red-500 text-red-500" /> Record
        </Link>
      </Button>
      {opts?.showWatch && row.recordingUrl && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWatchRecording({ url: row.recordingUrl!, title: row.title })}
        >
          <Play className="h-3 w-3 mr-1" /> Watch
        </Button>
      )}
    </div>
  );

  const baseColumns: ColumnDef<LiveClass>[] = [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "courseTitle", header: "Course" },
    { accessorKey: "batchName", header: "Batch", cell: ({ row }) => row.original.batchName || "—" },
    {
      accessorKey: "scheduledAt",
      header: "Scheduled At",
      cell: ({ row }) => formatDateTime(row.original.scheduledAt),
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => `${row.original.duration || "—"} min`,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
  ];

  const activeColumns: ColumnDef<LiveClass>[] = [
    { accessorKey: "title", header: "Title" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => actionCell(row.original),
    },
    { accessorKey: "courseTitle", header: "Course" },
    { accessorKey: "batchName", header: "Batch", cell: ({ row }) => row.original.batchName || "—" },
    {
      accessorKey: "scheduledAt",
      header: "Scheduled At",
      cell: ({ row }) => formatDateTime(row.original.scheduledAt),
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => `${row.original.duration || "—"} min`,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
    {
      accessorKey: "meetingLink",
      header: "Meeting",
      cell: ({ row }) =>
        row.original.meetingLink ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigator.clipboard.writeText(row.original.meetingLink!)}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy
          </Button>
        ) : (
          "—"
        ),
    },
  ];

  const completedColumns: ColumnDef<LiveClass>[] = [
    { accessorKey: "title", header: "Title" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => actionCell(row.original, { showWatch: true }),
    },
    ...baseColumns.slice(1),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Live Classes</h1>
          <p className="text-sm text-muted-foreground">
            Click Join to open Google Meet and the recording studio. Then click Start recording.
          </p>
        </div>

        {assignedCourse && session?.user && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Live Class
          </Button>
        )}
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Upcoming ({activeClasses.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedClasses.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {loadingActive ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <DataTable
              columns={activeColumns}
              data={activeClasses}
              searchPlaceholder="Search classes..."
            />
          )}
        </TabsContent>
        <TabsContent value="completed">
          {loadingCompleted ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <DataTable
              columns={completedColumns}
              data={completedClasses}
              searchPlaceholder="Search completed classes..."
            />
          )}
        </TabsContent>
      </Tabs>

      {assignedCourse && session?.user && (
        <AddMentorLiveClassModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          courseId={assignedCourse.id}
          courseTitle={assignedCourse.title}
          courses={assignedCourses}
          mentorId={session.user.id}
          mentorName={session.user.name || "Mentor"}
        />
      )}

      <WatchRecordingModal
        open={!!watchRecording}
        onOpenChange={(open) => !open && setWatchRecording(null)}
        videoUrl={watchRecording?.url ?? ""}
        title={watchRecording?.title ?? ""}
      />
    </div>
  );
}
