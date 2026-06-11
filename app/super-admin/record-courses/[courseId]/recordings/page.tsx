"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddCourseRecordingModal } from "@/components/modals/AddCourseRecordingModal";
import type { CourseRecording } from "@/lib/db/schema";
import { format } from "date-fns";

export default function RecordCourseRecordingsPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CourseRecording | undefined>();

  const { data: course } = useQuery<{ title: string }>({
    queryKey: ["record-course", courseId],
    queryFn: async () => {
      const res = await fetch(`/api/record-courses/${courseId}`);
      return res.json();
    },
  });

  const { data: recordings = [], isLoading } = useQuery<CourseRecording[]>({
    queryKey: ["course-recordings", courseId],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/recordings?courseId=${courseId}`);
      return res.json();
    },
  });

  const deleteRecording = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/super-admin/recordings/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["course-recordings", courseId] }),
  });

  const nextSortOrder =
    recordings.length > 0 ? Math.max(...recordings.map((r) => r.sortOrder)) + 1 : 0;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/super-admin/record-courses" className="hover:text-primary">
          Record Courses
        </Link>
        {" > "}
        <span>{course?.title ?? "Course"}</span>
        {" > "}
        <span className="text-foreground">Recordings</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Course Recordings — {course?.title ?? "..."}
        </h1>
        <Button
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Recording
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : recordings.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No recordings yet. Add the first recording for this course.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordings.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell>{rec.sortOrder}</TableCell>
                <TableCell>{rec.title}</TableCell>
                <TableCell>{rec.duration ? `${rec.duration} min` : "—"}</TableCell>
                <TableCell>
                  <Badge variant={rec.isPublished ? "success" : "secondary"}>
                    {rec.isPublished ? "Published" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {rec.createdAt ? format(new Date(rec.createdAt), "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(rec);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "This will remove access for all enrolled students. Delete this recording?"
                        )
                      ) {
                        deleteRecording.mutate(rec.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddCourseRecordingModal
        courseId={courseId}
        existingRecording={editing}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["course-recordings", courseId] })
        }
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}
