"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Play, Plus, Pencil, Trash2 } from "lucide-react";
import { WatchRecordingModal } from "@/components/modals/WatchRecordingModal";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddLiveClassModal } from "@/components/modals/AddLiveClassModal";
import { EditLiveClassModal } from "@/components/modals/EditLiveClassModal";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

type LiveClass = {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  batchId: string;
  batchName: string;
  mentorId: string;
  mentorName: string;
  scheduledAt: string;
  status: string;
  meetingLink: string;
  recordingUrl?: string;
  duration?: number;
};

function statusBadge(status: string) {
  if (status === "live") return <Badge variant="success">live</Badge>;
  if (status === "scheduled") return <Badge variant="warning">scheduled</Badge>;
  if (status === "completed") return <Badge variant="outline">completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function LiveClassesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editClass, setEditClass] = useState<LiveClass | undefined>();
  const [watchRecording, setWatchRecording] = useState<{ url: string; title: string } | null>(null);

  const { data: activeClasses = [], isLoading: loadingActive } = useQuery<LiveClass[]>({
    queryKey: ["live-classes", "active"],
    queryFn: async () => {
      const res = await fetch("/api/live-classes?tab=active");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: completedClasses = [], isLoading: loadingCompleted } = useQuery<LiveClass[]>({
    queryKey: ["live-classes", "completed"],
    queryFn: async () => {
      const res = await fetch("/api/live-classes?tab=completed");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const deleteClass = useMutation({
    mutationFn: (id: string) => fetch(`/api/live-classes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-classes"] });
    },
  });

  const baseColumns: ColumnDef<LiveClass>[] = [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "courseTitle", header: "Course" },
    { accessorKey: "batchName", header: "Batch", cell: ({ row }) => row.original.batchName || "—" },
    { accessorKey: "mentorName", header: "Mentor" },
    {
      accessorKey: "scheduledAt",
      header: "Scheduled At",
      cell: ({ row }) => formatDateTime(row.original.scheduledAt),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
  ];

  const activeColumns: ColumnDef<LiveClass>[] = [
    ...baseColumns,
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditClass(row.original)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Delete "${row.original.title}"?`)) {
                deleteClass.mutate(row.original.id);
              }
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  const completedColumns: ColumnDef<LiveClass>[] = [
    ...baseColumns,
    {
      accessorKey: "recordingUrl",
      header: "Recording",
      cell: ({ row }) =>
        row.original.recordingUrl ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setWatchRecording({
                url: row.original.recordingUrl!,
                title: row.original.title,
              })
            }
          >
            <Play className="h-3 w-3 mr-1" /> Watch
          </Button>
        ) : (
          "—"
        ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setEditClass(row.original)}>
          <Pencil className="h-3 w-3 mr-1" /> Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Live Classes">
        <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Add Live Class
        </Button>
      </PageHeader>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Upcoming ({activeClasses.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedClasses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {loadingActive ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <DataTable
              columns={activeColumns}
              data={activeClasses}
              searchPlaceholder="Search upcoming classes..."
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

      <AddLiveClassModal open={modalOpen} onOpenChange={setModalOpen} />
      <EditLiveClassModal
        open={!!editClass}
        onOpenChange={(o) => !o && setEditClass(undefined)}
        liveClass={editClass}
      />
      <WatchRecordingModal
        open={!!watchRecording}
        onOpenChange={(open) => !open && setWatchRecording(null)}
        videoUrl={watchRecording?.url ?? ""}
        title={watchRecording?.title ?? ""}
      />
    </div>
  );
}
