"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ExternalLink, Video } from "lucide-react";
import { WatchRecordingModal } from "@/components/modals/WatchRecordingModal";

type Recording = {
  id: string;
  weekName: string;
  topicName: string;
  videoUrl: string;
  courseTitle: string;
  batchName: string;
  createdAt: string;
};

export default function StudentRecordingClassesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState({ url: "", title: "" });

  const { data: recordings = [], isLoading } = useQuery<Recording[]>({
    queryKey: ["student-recordings"],
    queryFn: async () => {
      const res = await fetch("/api/student/recordings");
      const data = await res.json();
      if (!res.ok) return [];
      return Array.isArray(data) ? data : [];
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Recording Classes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recorded sessions for your enrolled batch.
        </p>
      </div>
      {recordings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No recordings uploaded for your batch yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {recordings.map((rec) => (
            <Card key={rec.id}>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
                <div className="flex items-start gap-3">
                  <Video className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{rec.topicName}</p>
                      <Badge variant="outline">{rec.weekName}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rec.courseTitle} · {rec.batchName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(rec.createdAt)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedVideo({ url: rec.videoUrl, title: rec.topicName });
                    setModalOpen(true);
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" /> Watch
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WatchRecordingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        videoUrl={selectedVideo.url}
        title={selectedVideo.title}
      />
    </div>
  );
}
