"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { BookOpen, ExternalLink } from "lucide-react";

type EnrolledCourse = {
  courseId: string;
  title: string;
  description: string;
  demoUrl?: string | null;
  batchName: string;
};

type LiveClass = {
  id: string;
  title: string;
  mentorName: string;
  meetingLink: string;
  scheduledAt: string;
  duration: number;
  status: string;
};

export default function StudentCoursesPage() {
  const { data: courses = [], isLoading } = useQuery<EnrolledCourse[]>({
    queryKey: ["student-courses"],
    queryFn: () => fetch("/api/student/courses").then((r) => r.json()),
  });

  const course = courses[0];
  const courseId = course?.courseId;

  const { data: upcoming = [], isLoading: isLoadingClasses } = useQuery<LiveClass[]>({
    queryKey: ["student-live-classes", courseId, "active"],
    queryFn: async () => {
      const res = await fetch(`/api/live-classes/student/${courseId}?tab=active`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!courseId,
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  if (courses.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Live Classes</h1>
          <p className="text-sm text-muted-foreground mt-1">Live Classes Schedule</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No courses enrolled yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 flex-wrap">
            {course.title}
            {course.batchName && (
              <Badge variant="outline" className="text-xs font-normal">
                {course.batchName}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Live Classes Schedule</p>
        </div>
      </div>

      {isLoadingClasses ? (
        <div className="text-muted-foreground">Loading classes...</div>
      ) : upcoming.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No upcoming live classes
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {upcoming.map((cls) => (
            <Card key={cls.id}>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
                <div>
                  <p className="font-medium">{cls.title}</p>
                  <p className="text-sm text-muted-foreground">Mentor: {cls.mentorName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(cls.scheduledAt)} · {cls.duration} min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={cls.status === "live" ? "success" : "warning"}>
                    {cls.status}
                  </Badge>
                  {cls.meetingLink && (
                    <Button asChild size="sm">
                      <a href={cls.meetingLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Join
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
