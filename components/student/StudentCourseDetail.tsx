"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Lock, Play, Calendar, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoPlayerModal } from "@/components/student/VideoPlayerModal";

type CourseContent = {
  enrollment: {
    batchId: string | null;
    enrollmentSource: string;
    hasLiveAccess: boolean;
  };
  courseRecordings: {
    id: string;
    title: string;
    description: string | null;
    videoUrl: string;
    duration: number | null;
    sortOrder: number;
  }[];
  liveClasses: {
    id: string;
    title: string;
    scheduledAt: Date | string;
    duration: number | null;
    meetingLink: string | null;
    status: string | null;
    recordingUrl: string | null;
  }[];
  liveClassRecordings: {
    id: string;
    title: string;
    scheduledAt: Date | string;
    recordingUrl: string | null;
    duration: number | null;
  }[];
};

function LockedPanel() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Live classes are available for batch-enrolled students.</p>
        <p className="text-sm text-muted-foreground">
          Your enrollment type does not include live class access.
        </p>
      </CardContent>
    </Card>
  );
}

function sourceLabel(source: string) {
  if (source === "public") return "Self Enrolled";
  if (source === "super_admin") return "Direct Enrollment";
  return "Organisation";
}

export function StudentCourseDetail({
  courseTitle,
  content,
}: {
  courseTitle: string;
  content: CourseContent;
}) {
  const [video, setVideo] = useState<{ url: string; title: string } | null>(null);
  const { enrollment } = content;
  const hasLive = enrollment.hasLiveAccess;

  const downloadIcs = (cls: CourseContent["liveClasses"][number]) => {
    const start = new Date(cls.scheduledAt);
    const end = new Date(start.getTime() + (cls.duration ?? 60) * 60_000);
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${start.toISOString().replace(/[-:]/g, "").split(".")[0]}Z\nDTEND:${end.toISOString().replace(/[-:]/g, "").split(".")[0]}Z\nSUMMARY:${cls.title}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cls.title}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{courseTitle}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{sourceLabel(enrollment.enrollmentSource)}</Badge>
          <span>
            Batch: {hasLive ? "Assigned" : "—"}
          </span>
          <span>{content.courseRecordings.length} recordings</span>
          <span>{content.liveClasses.length} live classes</span>
          <span>{content.liveClassRecordings.length} live recordings</span>
        </div>
      </div>

      <Tabs defaultValue="recordings">
        <TabsList>
          <TabsTrigger value="recordings">Course Recordings</TabsTrigger>
          <TabsTrigger value="live" disabled={!hasLive} title={!hasLive ? "Not available for your enrollment" : undefined}>
            Live Classes
          </TabsTrigger>
          <TabsTrigger value="live-recordings" disabled={!hasLive} title={!hasLive ? "Not available for your enrollment" : undefined}>
            Live Recordings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recordings" className="mt-4 space-y-3">
          {content.courseRecordings.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No recordings have been published for this course yet.
            </p>
          ) : (
            content.courseRecordings.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">#{rec.sortOrder + 1}</p>
                    <p className="font-medium">{rec.title}</p>
                    {rec.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{rec.description}</p>
                    )}
                    {rec.duration != null && (
                      <Badge variant="secondary" className="mt-1">
                        {rec.duration} min
                      </Badge>
                    )}
                  </div>
                  <Button onClick={() => setVideo({ url: rec.videoUrl, title: rec.title })}>
                    <Play className="mr-2 h-4 w-4" /> Play
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-4">
          {!hasLive ? (
            <LockedPanel />
          ) : content.liveClasses.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No live classes have been scheduled for your batch yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Scheduled</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {content.liveClasses.map((cls) => (
                    <tr key={cls.id} className="border-t">
                      <td className="p-3">{cls.title}</td>
                      <td className="p-3">{format(new Date(cls.scheduledAt), "MMM d, yyyy h:mm a")}</td>
                      <td className="p-3">{cls.duration ?? 60} min</td>
                      <td className="p-3">
                        {cls.status === "live" && (
                          <Badge className="animate-pulse bg-red-500/20 text-red-400">LIVE NOW</Badge>
                        )}
                        {cls.status === "scheduled" && (
                          <Badge className="bg-amber-500/20 text-amber-400">Upcoming</Badge>
                        )}
                        {cls.status === "completed" && !cls.recordingUrl && (
                          <Badge variant="secondary">Recording Pending</Badge>
                        )}
                        {cls.status === "completed" && cls.recordingUrl && (
                          <Badge className="bg-emerald-500/20 text-emerald-400">Completed</Badge>
                        )}
                        {cls.status === "cancelled" && (
                          <Badge variant="destructive">Cancelled</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {cls.status === "scheduled" && (
                          <Button size="sm" variant="outline" onClick={() => downloadIcs(cls)}>
                            <Calendar className="mr-1 h-3 w-3" /> Add to Calendar
                          </Button>
                        )}
                        {cls.status === "live" && cls.meetingLink && (
                          <Button size="sm" asChild>
                            <a href={cls.meetingLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" /> Join Now
                            </a>
                          </Button>
                        )}
                        {cls.status === "completed" && cls.recordingUrl && (
                          <Button
                            size="sm"
                            onClick={() =>
                              setVideo({ url: cls.recordingUrl!, title: cls.title })
                            }
                          >
                            Watch Recording
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="live-recordings" className="mt-4">
          {!hasLive ? (
            <LockedPanel />
          ) : content.liveClassRecordings.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No recordings available yet. Check back after your live sessions.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {content.liveClassRecordings.map((rec) => (
                <Card key={rec.id}>
                  <CardContent className="space-y-2 py-4">
                    <p className="font-medium">{rec.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(rec.scheduledAt), "MMM d, yyyy")}
                    </p>
                    {rec.duration != null && (
                      <Badge variant="secondary">{rec.duration} min</Badge>
                    )}
                    <Button
                      className="w-full"
                      onClick={() =>
                        setVideo({ url: rec.recordingUrl!, title: rec.title })
                      }
                    >
                      <Play className="mr-2 h-4 w-4" /> Play
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <VideoPlayerModal
        isOpen={!!video}
        onClose={() => setVideo(null)}
        videoUrl={video?.url ?? ""}
        title={video?.title ?? ""}
      />
    </div>
  );
}
