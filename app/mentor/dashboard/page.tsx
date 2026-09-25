"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Film, Video, Users, Layers, ArrowRight, AlertCircle } from "lucide-react";

type MentorCourse = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  language: string | null;
  totalHours: number | null;
  totalLiveHours: number | null;
  batchCount: number;
  recordingCount: number;
  studentCount: number;
};

type MentorCourseResponse = {
  course: MentorCourse | null;
  courses?: MentorCourse[];
};

export default function MentorDashboardPage() {
  const { data, isLoading } = useQuery<MentorCourseResponse>({
    queryKey: ["mentor-course"],
    queryFn: async () => {
      const res = await fetch("/api/mentor/course");
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground p-6">Loading dashboard...</div>;
  }

  const courses = data?.courses?.length ? data.courses : data?.course ? [data.course] : [];
  const course = courses[0];
  const batchCount = courses.reduce((sum, row) => sum + (row.batchCount || 0), 0);
  const recordingCount = courses.reduce((sum, row) => sum + (row.recordingCount || 0), 0);
  const studentCount = courses.reduce((sum, row) => sum + (row.studentCount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mentor Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome to your mentor workspace. Manage your live classes and batch recordings.
        </p>
      </div>

      {!course ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">No Course Assigned</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You haven't been assigned to a live course yet. Please reach out to your administrator
              to link a course to your mentor profile.
            </p>
            <Button variant="outline" asChild className="mt-2">
              <Link href="/mentor/live-classes">
                <Video className="h-4 w-4 mr-2" /> View Assigned Live Classes
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Batches
                </CardTitle>
                <Layers className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{batchCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Batches under your courses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Class Recordings
                </CardTitle>
                <Film className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recordingCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Uploaded batch recordings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Enrolled Students
                </CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Active course learners</p>
              </CardContent>
            </Card>
          </div>

          {/* Assigned Course Card */}
          <div>
            <h2 className="text-lg font-semibold mb-3">
              {courses.length > 1 ? "My Assigned Courses" : "My Assigned Course"}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {courses.map((row) => (
                <Card key={row.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-primary" />
                          <CardTitle className="text-xl">{row.title}</CardTitle>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {row.description || "No description provided for this course."}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-primary/10 text-primary border-primary/20">
                        {row.level || "Live Course"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {row.language && (
                        <span className="bg-muted px-2 py-1 rounded">Language: {row.language}</span>
                      )}
                      {row.totalHours && (
                        <span className="bg-muted px-2 py-1 rounded">Total: {row.totalHours} hrs</span>
                      )}
                      {row.totalLiveHours && (
                        <span className="bg-muted px-2 py-1 rounded">Live: {row.totalLiveHours} hrs</span>
                      )}
                      <span className="bg-muted px-2 py-1 rounded">{row.batchCount} batches</span>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button asChild className="gap-2">
                        <Link href={`/mentor/recording-classes/${row.id}`}>
                          <Film className="h-4 w-4" /> View Recording Classes & Batches
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                      <Button variant="outline" asChild className="gap-2">
                        <Link href="/mentor/live-classes">
                          <Video className="h-4 w-4" /> Schedule & View Live Classes
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
