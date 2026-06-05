"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Play } from "lucide-react";

type EnrolledCourse = {
  courseId: string;
  title: string;
  description: string;
  demoUrl?: string | null;
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
                <div className="h-28 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between px-6 rounded-t-xl border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Play className="h-5 w-5 fill-cyan-400/20" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Course Module</p>
                      <p className="text-sm font-semibold text-foreground font-sans">Interactive Learning</p>
                    </div>
                  </div>
                </div>
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
