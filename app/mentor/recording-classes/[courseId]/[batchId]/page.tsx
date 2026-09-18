"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, ArrowLeft, Play } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { AddClassRecordingModal } from "@/components/modals/AddClassRecordingModal";
import { WatchRecordingModal } from "@/components/modals/WatchRecordingModal";
import { formatDateTime } from "@/lib/utils";

type Recording = {
  id: string;
  weekName: string;
  topicName: string;
  videoUrl: string;
  createdAt: string;
  uploaderName?: string | null;
};

export default function MentorBatchRecordingsPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const batchId = params.batchId as string;
  const [modalOpen, setModalOpen] = useState(false);
  const [watchRecording, setWatchRecording] = useState<{ url: string; title: string } | null>(null);

  const { data: recordings = [], isLoading } = useQuery<Recording[]>({
    queryKey: ["class-recordings", batchId],
    queryFn: () =>
      fetch(`/api/class-recordings?batchId=${batchId}&courseId=${courseId}`).then((r) => r.json()),
  });

  const columns: ColumnDef<Recording>[] = [
    { accessorKey: "weekName", header: "Week" },
    { accessorKey: "topicName", header: "Topic" },
    {
      accessorKey: "videoUrl",
      header: "Video",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setWatchRecording({
              url: row.original.videoUrl,
              title: row.original.topicName,
            })
          }
        >
          <Play className="h-3 w-3 mr-1" /> Watch
        </Button>
      ),
    },
    {
      accessorKey: "uploaderName",
      header: "Uploaded By",
      cell: ({ row }) => row.original.uploaderName || "—",
    },
    {
      accessorKey: "createdAt",
      header: "Uploaded",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    // Deleting recordings is reserved for super_admin / manager; mentors can only upload.
  ];

  if (isLoading) {
    return <div className="text-muted-foreground p-6">Loading batch recordings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/mentor/recording-classes/${courseId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Batches
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Batch Recordings</h1>
            <p className="text-sm text-muted-foreground">
              Manage and upload class recordings for this batch.
            </p>
          </div>
        </div>

        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Upload Recording
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={recordings}
        searchPlaceholder="Search by topic or week..."
      />

      <AddClassRecordingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        courseId={courseId}
        batchId={batchId}
      />

      {watchRecording && (
        <WatchRecordingModal
          open={!!watchRecording}
          onOpenChange={(o) => !o && setWatchRecording(null)}
          videoUrl={watchRecording.url}
          title={watchRecording.title}
        />
      )}
    </div>
  );
}
