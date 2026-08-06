"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/DataTable";
import { AddStudentModal } from "@/components/modals/AddStudentModal";
import { EditStudentModal } from "@/components/modals/EditStudentModal";
import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Course = {
  id: string;
  title: string;
  price: string;
  totalSlots: number;
  usedSlots: number;
  remaining: number;
};
type Student = {
  id: string;
  name: string;
  email: string;
  lmsId: string;
  isActive: boolean;
  phone?: string | null;
  collegeName?: string | null;
};

export default function OrgAdminRecordStudentsPage() {
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | undefined>();

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["purchased-record-courses"],
    queryFn: () => fetch("/api/org-admin/purchased-record-courses").then((r) => r.json()),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["students", selectedCourse?.id, "record"],
    queryFn: async () => {
      const res = await fetch(`/api/students?courseId=${selectedCourse!.id}`);
      const resData = await res.json();
      if (!res.ok) return [];
      return Array.isArray(resData?.data) ? resData.data : [];
    },
    enabled: !!selectedCourse,
  });

  const deleteStudent = useMutation({
    mutationFn: (id: string) => fetch(`/api/students/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["purchased-record-courses"] });
    },
  });

  const columns: ColumnDef<Student>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "lmsId", header: "LMS ID" },
    { accessorKey: "email", header: "Email" },
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
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditStudent(row.original)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Move "${row.original.name}" to trash?`)) {
                deleteStudent.mutate(row.original.id);
              }
            }}
            disabled={deleteStudent.isPending}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Record Students</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign students to record courses you have purchased seats for.
        </p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No record course seats purchased yet. Buy seats from{" "}
            <a href="/org-admin/record-courses" className="text-primary underline">
              Record Courses
            </a>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card
              key={course.id}
              className={`cursor-pointer transition-all ${selectedCourse?.id === course.id ? "ring-2 ring-violet-400" : "hover:border-violet-400/30"}`}
              onClick={() => setSelectedCourse(course)}
            >
              <CardHeader>
                <CardTitle className="text-base">{course.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{formatCurrency(course.price)} / seat</p>
                <div className="flex gap-2 text-xs font-mono">
                  <Badge variant="outline">Total: {course.totalSlots}</Badge>
                  <Badge variant="outline">Used: {course.usedSlots}</Badge>
                  <Badge variant="success">Left: {course.remaining}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="max-w-4xl max-h-[min(90dvh,90vh)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{selectedCourse?.title} — Students</DialogTitle>
            <DialogDescription>
              Enrolled students for this record course.
            </DialogDescription>
          </DialogHeader>

          {selectedCourse && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedCourse.remaining} seat{selectedCourse.remaining === 1 ? "" : "s"} remaining
                </p>
                <Button size="sm" onClick={() => setStudentModalOpen(true)} disabled={selectedCourse.remaining <= 0}>
                  <Plus className="h-4 w-4 mr-2" /> Add Student
                </Button>
              </div>
              <DataTable columns={columns} data={students} searchPlaceholder="Search students..." />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedCourse && (
        <>
          <AddStudentModal
            key={selectedCourse.id}
            open={studentModalOpen}
            onOpenChange={setStudentModalOpen}
            courseId={selectedCourse.id}
            courseName={selectedCourse.title}
            courseType="record"
            showCourseSelect={false}
          />
          <EditStudentModal
            open={!!editStudent}
            onOpenChange={(o) => !o && setEditStudent(undefined)}
            student={editStudent}
          />
        </>
      )}
    </div>
  );
}
