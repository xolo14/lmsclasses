"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

type LiveClass = {
  id: string;
  title: string;
  mentorName: string;
  meetingLink: string;
  scheduledAt: string;
  duration: number;
  status: string;
};

export default function StudentCourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const { data: upcoming = [], isLoading } = useQuery<LiveClass[]>({
    queryKey: ["student-live-classes", courseId, "active"],
    queryFn: async () => {
      const res = await fetch(`/api/live-classes/student/${courseId}?tab=active`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Course Details</h1>
      <h2 className="text-lg font-semibold">Live Classes</h2>
      {upcoming.length === 0 ? (
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
