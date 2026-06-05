"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2, ArrowLeft, ExternalLink, FileSpreadsheet } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { AddClassRecordingModal } from "@/components/modals/AddClassRecordingModal";
import { BulkImportModal } from "@/components/modals/BulkImportModal";
import { formatDateTime } from "@/lib/utils";

type Recording = {
  id: string;
  weekName: string;
  topicName: string;
  videoUrl: string;
  createdAt: string;
  uploaderName: string;
};

export default function BatchRecordingsPage() {
  const params = useParams();
  const pathname = usePathname();
  const base = pathname.includes("/manager/") ? "/manager" : "/super-admin";
  const courseId = params.courseId as string;
  const batchId = params.batchId as string;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const { data: recordings = [], isLoading } = useQuery<Recording[]>({
    queryKey: ["class-recordings", batchId],
    queryFn: () =>
      fetch(`/api/class-recordings?batchId=${batchId}&courseId=${courseId}`).then((r) => r.json()),
  });

  const deleteRecording = useMutation({
    mutationFn: (id: string) => fetch(`/api/class-recordings/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["class-recordings", batchId] }),
  });

  const columns: ColumnDef<Recording>[] = [
    { accessorKey: "weekName", header: "Week" },
    { accessorKey: "topicName", header: "Topic" },
    {
      accessorKey: "videoUrl",
      header: "Video",
      cell: ({ row }) => (
        <a
          href={row.original.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline flex items-center gap-1 text-sm"
        >
          Watch <ExternalLink className="h-3 w-3" />
        </a>
      ),
    },
    { accessorKey: "uploaderName", header: "Uploaded By" },
    {
      accessorKey: "createdAt",
      header: "Uploaded",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => deleteRecording.mutate(row.original.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${base}/recording-classes/${courseId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Batch Recordings</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setImportModalOpen(true)} className="w-full sm:w-auto">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Bulk Import
          </Button>
          <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Upload Recording
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={recordings} searchPlaceholder="Search recordings..." />
      <AddClassRecordingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        courseId={courseId}
        batchId={batchId}
      />
      <BulkImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Bulk Import Class Recordings"
        description="Upload an Excel or CSV file containing recording details for this batch. The table below shows a preview of parsed records."
        templateHeaders={["Week Name", "Topic Name", "Video URL"]}
        templateSampleRows={[
          ["Week 1", "Introduction to React and JSX", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          ["Week 2", "React Hooks & State Management", "https://vimeo.com/83949210"]
        ]}
        headerMapping={{
          weekName: "Week Name",
          topicName: "Topic Name",
          videoUrl: "Video URL"
        }}
        onImport={async (data) => {
          const res = await fetch("/api/class-recordings/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseId,
              batchId,
              recordings: data
            }),
          });
          const json = await res.json();
          if (!res.ok) {
            return { successCount: 0, error: json.error || "Failed to bulk import recordings." };
          }
          return { successCount: json.successCount };
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["class-recordings", batchId] });
        }}
      />
    </div>
  );
}
