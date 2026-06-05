"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCourseModal } from "@/components/modals/AddCourseModal";
import { BulkImportModal } from "@/components/modals/BulkImportModal";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

type Course = {
  id: string;
  title: string;
  description: string;
  price: string;
  thumbnailUrl: string;
  isActive: boolean;
  enrolledCount: number;
};

export default function CoursesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | undefined>();

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: () => fetch("/api/courses").then((r) => r.json()),
  });

  const deleteCourse = useMutation({
    mutationFn: (id: string) => fetch(`/api/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] }),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Courses">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setImportModalOpen(true)} className="w-full sm:w-auto">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Bulk Import
          </Button>
          <Button onClick={() => { setEditCourse(undefined); setModalOpen(true); }} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Course
          </Button>
        </div>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.id}>
            {course.thumbnailUrl && (
              <div className="h-40 overflow-hidden rounded-t-xl">
                <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
              </div>
            )}
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{course.title}</CardTitle>
                <Badge variant={course.isActive ? "success" : "destructive"}>
                  {course.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-primary">{formatCurrency(course.price)}</span>
                <span className="text-sm text-muted-foreground">{course.enrolledCount} enrolled</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => { setEditCourse(course); setModalOpen(true); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteCourse.mutate(course.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
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
        course={editCourse}
      />
      <BulkImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Bulk Import Courses"
        description="Upload an Excel or CSV file containing course details. The table below shows a preview of parsed records."
        templateHeaders={["Title", "Description", "Price", "Thumbnail URL"]}
        templateSampleRows={[
          ["Python for Beginners", "Learn programming basics from scratch.", "1999", "https://images.unsplash.com/photo-1515879218367-8466d910aaa4"],
          ["Web Design Principles", "Visual composition, typography, grids, and layouts.", "2999", ""]
        ]}
        headerMapping={{
          title: "Title",
          description: "Description",
          price: "Price",
          thumbnailUrl: "Thumbnail URL"
        }}
        onImport={async (data) => {
          const res = await fetch("/api/courses/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json();
          if (!res.ok) {
            return { successCount: 0, error: json.error || "Failed to bulk import courses." };
          }
          return { successCount: json.successCount };
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["courses"] });
        }}
      />
    </div>
  );
}
