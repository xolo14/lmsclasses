"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft, Layers, Film } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Batch = {
  id: string;
  name: string;
  courseTitle?: string;
  orgName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  enrolledCount: number;
};

export default function MentorRecordingClassesCoursePage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ["batches", courseId],
    queryFn: () => fetch(`/api/batches?courseId=${courseId}`).then((r) => r.json()),
  });

  if (isLoading) {
    return <div className="text-muted-foreground p-6">Loading batches...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/mentor/dashboard">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Select Batch</h1>
          <p className="text-sm text-muted-foreground">
            Choose a batch to view and upload class recordings.
          </p>
        </div>
      </div>

      {batches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            No active batches found for this course yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/mentor/recording-classes/${courseId}/${batch.id}`}
            >
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{batch.name}</CardTitle>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {batch.orgName && <p>Organisation: {batch.orgName}</p>}
                  <p>
                    Duration: {formatDate(batch.startDate)} — {formatDate(batch.endDate)}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <Badge variant="outline">{batch.enrolledCount} students enrolled</Badge>
                    <span className="text-xs text-primary flex items-center gap-1 font-medium">
                      <Film className="h-3.5 w-3.5" /> Manage Recordings
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
