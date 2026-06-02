"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Batch = {
  id: string;
  name: string;
  orgName: string;
  startDate: string;
  endDate: string;
  enrolledCount: number;
};

export default function RecordingClassesCoursePage() {
  const params = useParams();
  const pathname = usePathname();
  const base = pathname.includes("/manager/") ? "/manager" : "/super-admin";
  const courseId = params.courseId as string;

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ["batches", courseId],
    queryFn: () => fetch(`/api/batches?courseId=${courseId}`).then((r) => r.json()),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${base}/recording-classes`}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Select Batch</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {batches.map((batch) => (
          <Link
            key={batch.id}
            href={`${base}/recording-classes/${courseId}/${batch.id}`}
          >
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{batch.name}</CardTitle>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Organisation: {batch.orgName || "—"}</p>
                <p>
                  {formatDate(batch.startDate)} — {formatDate(batch.endDate)}
                </p>
                <Badge variant="outline">{batch.enrolledCount} students</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
