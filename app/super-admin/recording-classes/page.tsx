"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Film } from "lucide-react";

type OngoingCourse = {
  id: string;
  title: string;
  description: string;
  batchCount: number;
};

export default function RecordingClassesPage() {
  const pathname = usePathname();
  const base = pathname.includes("/manager/") ? "/manager" : "/super-admin";

  const { data: courses = [], isLoading } = useQuery<OngoingCourse[]>({
    queryKey: ["ongoing-courses"],
    queryFn: () => fetch("/api/recording-classes/ongoing").then((r) => r.json()),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Recording Classes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ongoing courses with active batches. Select a course to manage recorded videos per batch.
        </p>
      </div>
      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No ongoing courses with active batches found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} href={`${base}/recording-classes/${course.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Film className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {course.description || "No description"}
                  </p>
                  <Badge variant="outline">{course.batchCount} active batch(es)</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
