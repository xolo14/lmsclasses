"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Play, Calendar, ExternalLink, Award, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoPlayerModal } from "@/components/student/VideoPlayerModal";
import { prefetchVideoUrl } from "@/lib/video-prefetch";
import { formatDate, formatDateTime } from "@/lib/utils";
import { liveClassHasAnyRecording, liveRecordingSlotsFromRow } from "@/lib/live-recording-slots";

type CourseContent = {
  enrollment: {
    batchId: string | null;
    enrollmentSource: string;
    hasLiveAccess: boolean;
    hasClassRecordingAccess?: boolean;
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
    recordingUrlB?: string | null;
    recordingUrlC?: string | null;
  }[];
  liveClassRecordings: {
    id: string;
    title: string;
    scheduledAt: Date | string;
    recordingUrl: string | null;
    duration: number | null;
  }[];
  batchClassRecordings?: {
    id: string;
    weekName: string;
    topicName: string;
    videoUrl: string;
    createdAt: Date | string | null;
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
  courseId,
  courseType = "live",
  content,
}: {
  courseTitle: string;
  courseId?: string;
  courseType?: string;
  content: CourseContent;
}) {
  const [video, setVideo] = useState<{ url: string; title: string } | null>(null);
  const { enrollment } = content;
  const hasLive = enrollment.hasLiveAccess;
  const hasRecordings = enrollment.hasClassRecordingAccess ?? hasLive;
  const batchId = enrollment.batchId;

  const { data: liveStatuses } = useQuery({
    queryKey: ["live-class-statuses", batchId],
    queryFn: async () => {
      const res = await fetch(`/api/student/live-status?batchId=${batchId}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60 * 1000,
    enabled: !!batchId && hasLive,
  });

  const { data: courseCerts = [] } = useQuery<
    {
      id: string;
      certificateNumber: string;
      issuedAt: string;
      isLocked?: boolean;
      unlockAt?: string | null;
    }[]
  >({
    queryKey: ["student-course-certs", courseId],
    queryFn: () =>
      fetch(`/api/student/certificates?courseId=${courseId}`).then((r) => r.json()),
    enabled: !!courseId,
  });

  const displayedLiveClasses = content.liveClasses.map((cls) => {
    const statusUpdate = Array.isArray(liveStatuses)
      ? liveStatuses.find((u: { id: string; status: string }) => u.id === cls.id)
      : null;
    if (statusUpdate) {
      return { ...cls, status: statusUpdate.status };
    }
    return cls;
  });
  const batchClassRecordings = content.batchClassRecordings ?? [];
  const liveRecordingCount = content.liveClassRecordings.length + batchClassRecordings.length;

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

  const defaultTab =
    courseType === "record"
      ? "recordings"
      : content.liveClasses.length === 0 && liveRecordingCount > 0
        ? "live-recordings"
        : "live";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{courseTitle}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{sourceLabel(enrollment.enrollmentSource)}</Badge>
          <span>
            Batch: {hasLive ? "Assigned" : "—"}
          </span>
          {courseType === "record" && (
            <span>{content.courseRecordings.length} recordings</span>
          )}
          {courseType === "live" && (
            <>
              <span>{content.liveClasses.length} live classes</span>
              <span>{liveRecordingCount} live recordings</span>
            </>
          )}
        </div>
      </div>

      {courseId && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Award className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Certificate</p>
                {courseCerts.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {courseCerts.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-mono text-primary">{c.certificateNumber}</p>
                          <p className="text-muted-foreground">
                            Generated {formatDate(c.issuedAt)}
                            {c.isLocked && c.unlockAt
                              ? ` · Unlocks ${formatDate(c.unlockAt)}`
                              : ""}
                          </p>
                        </div>
                        {c.isLocked ? (
                          <Button size="sm" variant="secondary" disabled>
                            <Lock className="mr-1 h-3.5 w-3.5" /> Locked
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" asChild>
                            <a href={`/api/certificates/${c.id}/download`}>
                              <Download className="mr-1 h-3.5 w-3.5" /> Download
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    With auto-issue, your certificate is generated on enrollment (locked) and
                    unlocks after course duration — then you can download and receive email.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs key={defaultTab} defaultValue={defaultTab}>
        <TabsList>
          {courseType === "record" && (
            <TabsTrigger value="recordings">Course Recordings</TabsTrigger>
          )}
          {courseType === "live" && (
            <>
              <TabsTrigger value="live" disabled={!hasLive} title={!hasLive ? "Not available for your enrollment" : undefined}>
                Live Classes
              </TabsTrigger>
              <TabsTrigger value="live-recordings" disabled={!hasRecordings} title={!hasRecordings ? "Not available for your enrollment" : undefined}>
                Live Recordings
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {courseType === "record" && (
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
                    <Button
                      onMouseEnter={() => prefetchVideoUrl(rec.videoUrl)}
                      onFocus={() => prefetchVideoUrl(rec.videoUrl)}
                      onClick={() => setVideo({ url: rec.videoUrl, title: rec.title })}
                    >
                      <Play className="mr-2 h-4 w-4" /> Play
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        )}

        {courseType === "live" && (
          <>
            <TabsContent value="live" className="mt-4">
              {!hasLive ? (
                <LockedPanel />
              ) : displayedLiveClasses.length === 0 ? (
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
                      {displayedLiveClasses.map((cls) => (
                        <tr key={cls.id} className="border-t">
                          <td className="p-3">{cls.title}</td>
                          <td className="p-3">{formatDateTime(cls.scheduledAt)}</td>
                          <td className="p-3">{cls.duration ?? 60} min</td>
                          <td className="p-3">
                            {cls.status === "live" && (
                              <Badge className="animate-pulse bg-red-500/20 text-red-400">LIVE NOW</Badge>
                            )}
                            {cls.status === "scheduled" && (
                              <Badge className="bg-amber-500/20 text-amber-400">Upcoming</Badge>
                            )}
                            {cls.status === "completed" && !liveClassHasAnyRecording(cls) && (
                              <Badge variant="secondary">Recording Pending</Badge>
                            )}
                            {cls.status === "completed" && liveClassHasAnyRecording(cls) && (
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
                            {cls.status === "completed" &&
                              liveRecordingSlotsFromRow(cls).map((slot) => (
                              <Button
                                key={slot.slot}
                                size="sm"
                                className="mr-1 mb-1"
                                onMouseEnter={() => prefetchVideoUrl(slot.url)}
                                onFocus={() => prefetchVideoUrl(slot.url)}
                                onClick={() =>
                                  setVideo({ url: slot.url, title: `${cls.title} (${slot.slot})` })
                                }
                              >
                                Watch {slot.slot}
                              </Button>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="live-recordings" className="mt-4">
              {!hasRecordings ? (
                <LockedPanel />
              ) : liveRecordingCount === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No recordings available yet. Check back after your live sessions.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {batchClassRecordings.map((rec) => (
                    <Card key={rec.id}>
                      <CardContent className="space-y-2 py-4">
                        <p className="text-xs text-muted-foreground">{rec.weekName}</p>
                        <p className="font-medium">{rec.topicName}</p>
                        {rec.createdAt && (
                          <p className="text-xs text-muted-foreground">{formatDate(rec.createdAt)}</p>
                        )}
                        <Button
                          className="w-full"
                          onMouseEnter={() => prefetchVideoUrl(rec.videoUrl)}
                          onFocus={() => prefetchVideoUrl(rec.videoUrl)}
                          onClick={() => setVideo({ url: rec.videoUrl, title: rec.topicName })}
                        >
                          <Play className="mr-2 h-4 w-4" /> Play
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {content.liveClassRecordings.map((rec) => (
                    <Card key={rec.id}>
                      <CardContent className="space-y-2 py-4">
                        <p className="font-medium">{rec.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(rec.scheduledAt)}
                        </p>
                        {rec.duration != null && (
                          <Badge variant="secondary">{rec.duration} min</Badge>
                        )}
                        <Button
                          className="w-full"
                          onMouseEnter={() => prefetchVideoUrl(rec.recordingUrl!)}
                          onFocus={() => prefetchVideoUrl(rec.recordingUrl!)}
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
          </>
        )}
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
