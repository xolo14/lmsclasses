"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/DataTable";
import { AddStudentModal } from "@/components/modals/AddStudentModal";
import { AddBatchModal } from "@/components/modals/AddBatchModal";
import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency, formatDate } from "@/lib/utils";

type Course = { id: string; title: string; price: string };
type Student = { id: string; name: string; email: string; lmsId: string; batchName: string; isActive: boolean };
type SlotInfo = { totalSlots: number; usedSlots: number; remaining: number };
type Batch = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  maxSlots: number;
  enrolledCount: number;
};

export default function OrgAdminStudentsPage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: () => fetch("/api/courses").then((r) => r.json()),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["students", selectedCourse?.id],
    queryFn: async () => {
      const res = await fetch(`/api/students?courseId=${selectedCourse!.id}`);
      const data = await res.json();
      if (!res.ok) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCourse,
  });

  const { data: batches = [], isLoading: batchesLoading } = useQuery<Batch[]>({
    queryKey: ["batches", selectedCourse?.id],
    queryFn: async () => {
      const res = await fetch(`/api/batches?courseId=${selectedCourse!.id}`);
      const data = await res.json();
      if (!res.ok) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCourse,
  });

  const columns: ColumnDef<Student>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "lmsId", header: "LMS ID" },
    { accessorKey: "email", header: "Email" },
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
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Students</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseSlotCard
            key={course.id}
            course={course}
            selected={selectedCourse?.id === course.id}
            onClick={() => setSelectedCourse(course)}
          />
        ))}
      </div>

      {selectedCourse && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Batches — {selectedCourse.title}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setBatchModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create Batch
              </Button>
            </CardHeader>
            <CardContent>
              {batchesLoading ? (
                <p className="text-sm text-muted-foreground">Loading batches...</p>
              ) : batches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No batches yet. Create a batch before adding students to one.
                </p>
              ) : (
                <div className="space-y-2">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{batch.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(batch.startDate)} — {formatDate(batch.endDate)}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <Badge variant="outline">Max: {batch.maxSlots}</Badge>
                        <Badge variant="outline">Enrolled: {batch.enrolledCount}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{selectedCourse.title} — Students</h2>
            <Button onClick={() => setStudentModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Student
            </Button>
          </div>
          <DataTable columns={columns} data={students} searchPlaceholder="Search students..." />
        </div>
      )}

      {selectedCourse && (
        <>
          <AddStudentModal
            key={selectedCourse.id}
            open={studentModalOpen}
            onOpenChange={setStudentModalOpen}
            courseId={selectedCourse.id}
            courseName={selectedCourse.title}
            showCourseSelect={false}
          />
          <AddBatchModal
            open={batchModalOpen}
            onOpenChange={setBatchModalOpen}
            defaultCourseId={selectedCourse.id}
            orgAdminMode
          />
        </>
      )}
    </div>
  );
}

function CourseSlotCard({
  course,
  selected,
  onClick,
}: {
  course: Course;
  selected: boolean;
  onClick: () => void;
}) {
  const { data: slots } = useQuery<SlotInfo>({
    queryKey: ["slots", course.id],
    queryFn: () => fetch(`/api/slots/${course.id}`).then((r) => r.json()),
  });

  return (
    <Card
      className={`cursor-pointer transition-all ${selected ? "ring-2 ring-cyan-400" : "hover:border-cyan-400/30"}`}
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="text-base">{course.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-2">{formatCurrency(course.price)} / slot</p>
        {slots && (
          <div className="flex gap-2 text-xs font-mono">
            <Badge variant="outline">Total: {slots.totalSlots}</Badge>
            <Badge variant="outline">Used: {slots.usedSlots}</Badge>
            <Badge variant="success">Left: {slots.remaining}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
