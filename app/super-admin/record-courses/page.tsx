"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Pencil, Trash2, FileSpreadsheet, Play, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCourseModal } from "@/components/modals/AddCourseModal";
import { BulkImportModal } from "@/components/modals/BulkImportModal";
import { DemoVideoModal } from "@/components/modals/DemoVideoModal";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

type Course = {
  id: string;
  title: string;
  description: string;
  price: string;
  duration?: string | null;
  demoUrl?: string | null;
  thumbnailUrl?: string | null;
  isActive: boolean;
  enrolledCount: number;
};

export default function RecordCoursesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | undefined>();

  // Demo Video Modal states
  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [demoCourseTitle, setDemoCourseTitle] = useState("");
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["record-courses"],
    queryFn: () => fetch("/api/record-courses").then((r) => r.json()),
  });

  const deleteCourse = useMutation({
    mutationFn: (id: string) => fetch(`/api/record-courses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["record-courses"] }),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Record Courses">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setImportModalOpen(true)} className="w-full sm:w-auto">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Bulk Import
          </Button>
          <Button onClick={() => { setEditCourse(undefined); setModalOpen(true); }} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Record Course
          </Button>
        </div>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.id}>
            <div className="relative h-28 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between px-6 rounded-t-xl border-b border-border/40 overflow-hidden">
              {course.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-40"
                />
              ) : null}
              <div className="relative z-10 flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Play className="h-5 w-5 fill-cyan-400/20" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Course Module</p>
                  <p className="text-sm font-semibold text-foreground">Self-Paced Curriculum</p>
                </div>
              </div>
              {course.demoUrl && (
                <Badge variant="secondary" className="bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 text-[10px]">
                  Demo Available
                </Badge>
              )}
              </div>
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{course.title}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={course.isActive ? "success" : "destructive"}>
                    {course.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {course.duration && (
                    <Badge variant="outline" className="text-[10px]">
                      {course.duration}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
              <div className="flex items-center justify-between animate-fade-in">
                <span className="font-mono text-primary">{formatCurrency(course.price)}</span>
                <span className="text-sm text-muted-foreground">{course.enrolledCount} enrolled</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/super-admin/record-courses/${course.id}/recordings`}>
                      <Film className="h-3 w-3 mr-1" /> Manage Recordings
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditCourse(course); setModalOpen(true); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteCourse.mutate(course.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
                {course.demoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-cyan-500/30 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/20"
                    onClick={() => {
                      setDemoVideoUrl(course.demoUrl || "");
                      setDemoCourseTitle(course.title);
                      setDemoModalOpen(true);
                    }}
                  >
                    <Play className="h-3 w-3 mr-1 fill-cyan-400/20" /> Demo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <AddCourseModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditCourse(undefined);
        }}
        type="record"
        course={editCourse}
      />
      <BulkImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Bulk Import Record Courses"
        description="Upload an Excel or CSV file containing record course details. The table below shows a preview of parsed records."
        templateHeaders={["Title", "Description", "Price", "Duration", "Demo URL"]}
        templateSampleRows={[
          ["Python for Beginners Self-Paced", "Learn programming basics from scratch at your own pace.", "999", "12 weeks", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          ["Web Design Self-Paced", "Visual composition, grids, layouts, and self-paced study.", "1499", "8 weeks", ""]
        ]}
        headerMapping={{
          title: "Title",
          description: "Description",
          price: "Price",
          duration: "Duration",
          demoUrl: "Demo URL"
        }}
        onImport={async (data) => {
          const res = await fetch("/api/record-courses/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json();
          if (!res.ok) {
            return { successCount: 0, error: json.error || "Failed to bulk import record courses." };
          }
          return { successCount: json.successCount };
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["record-courses"] });
        }}
      />
      {demoVideoUrl && (
        <DemoVideoModal
          open={demoModalOpen}
          onOpenChange={setDemoModalOpen}
          videoUrl={demoVideoUrl}
          courseTitle={demoCourseTitle}
        />
      )}
    </div>
  );
}
