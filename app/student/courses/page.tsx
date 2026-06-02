"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

type EnrolledCourse = {
  courseId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  batchName: string;
};

export default function StudentCoursesPage() {
  const { data: courses = [], isLoading } = useQuery<EnrolledCourse[]>({
    queryKey: ["student-courses"],
    queryFn: () => fetch("/api/student/courses").then((r) => r.json()),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">My Courses</h1>
      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No courses enrolled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.courseId} href={`/student/courses/${course.courseId}`}>
              <Card className="hover:border-cyan-400/30 transition-all cursor-pointer h-full">
                {course.thumbnailUrl && (
                  <div className="h-40 overflow-hidden rounded-t-xl">
                    <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
                  {course.batchName && <Badge variant="outline">{course.batchName}</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
