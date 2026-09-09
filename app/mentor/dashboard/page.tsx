"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Film, Video, Users, Layers, ArrowRight, AlertCircle } from "lucide-react";

type MentorCourseResponse = {
  course: {
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
  } | null;
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

  const course = data?.course;

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
                <div className="text-2xl font-bold">{course.batchCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Batches under your course</p>
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
                <div className="text-2xl font-bold">{course.recordingCount}</div>
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
                <div className="text-2xl font-bold">{course.studentCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Active course learners</p>
              </CardContent>
            </Card>
          </div>

          {/* Assigned Course Card */}
          <div>
            <h2 className="text-lg font-semibold mb-3">My Assigned Course</h2>
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xl">{course.title}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {course.description || "No description provided for this course."}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 bg-primary/10 text-primary border-primary/20">
                    {course.level || "Live Course"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {course.language && (
                    <span className="bg-muted px-2 py-1 rounded">Language: {course.language}</span>
                  )}
                  {course.totalHours && (
                    <span className="bg-muted px-2 py-1 rounded">Total: {course.totalHours} hrs</span>
                  )}
                  {course.totalLiveHours && (
                    <span className="bg-muted px-2 py-1 rounded">Live: {course.totalLiveHours} hrs</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button asChild className="gap-2">
                    <Link href={`/mentor/recording-classes/${course.id}`}>
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
          </div>
        </div>
      )}
    </div>
  );
}
