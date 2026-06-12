"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Play, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmbeddedVideoPlayer } from "@/components/ui/embedded-video-player";
import { resolveVideoEmbed, type ResolvedVideoEmbed } from "@/lib/video-embed";

type Course = {
  id: string;
  title: string;
  description: string;
  price: string;
  demoUrl?: string | null;
  isActive: boolean;
  enrolledCount: number;
};

interface DemosPageProps {
  /** Org admin: live courses only. Super admin: all course types. */
  liveOnly?: boolean;
}

export function DemosPage({ liveOnly = false }: DemosPageProps) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [embed, setEmbed] = useState<ResolvedVideoEmbed | null>(null);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["demos-courses", liveOnly ? "live" : "all"],
    queryFn: async () => {
      if (liveOnly) {
        const res = await fetch("/api/live-courses");
        const data = res.ok ? await res.json() : [];
        return Array.isArray(data) ? data : [];
      }
      const [liveRes, recordRes] = await Promise.all([
        fetch("/api/live-courses"),
        fetch("/api/record-courses"),
      ]);
      const [liveCourses, recordCourses] = await Promise.all([
        liveRes.ok ? liveRes.json() : [],
        recordRes.ok ? recordRes.json() : [],
      ]);
      return [
        ...(Array.isArray(liveCourses) ? liveCourses : []),
        ...(Array.isArray(recordCourses) ? recordCourses : []),
      ];
    },
  });

  // Filter courses that have a valid demoUrl
  const demoCourses = courses.filter((c) => c.demoUrl && c.demoUrl.trim().length > 0);

  // Set the first course with a demo as selected by default when data loads
  useEffect(() => {
    if (demoCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(demoCourses[0]);
    }
  }, [demoCourses, selectedCourse]);

  useEffect(() => {
    if (!selectedCourse?.demoUrl) {
      setEmbed(null);
      return;
    }
    setEmbed(resolveVideoEmbed(selectedCourse.demoUrl, true));
  }, [selectedCourse]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-muted-foreground animate-pulse text-lg font-medium">Loading Course Demos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Course Demos" description="Watch interactive course demo videos and walkthroughs." />

      {demoCourses.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">No Demos Available</p>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              None of the courses have a demo video set. Add a &quot;Demo URL&quot; to a course to display it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Video Player section (Left side) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative aspect-video w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xl flex items-center justify-center">
              {selectedCourse ? (
                <EmbeddedVideoPlayer
                  embed={embed}
                  videoUrl={selectedCourse.demoUrl || ""}
                  title={`Demo video for ${selectedCourse.title}`}
                  autoPlay
                />
              ) : null}
            </div>

            {selectedCourse && (
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-xl font-bold text-foreground">{selectedCourse.title}</h2>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-950/20 font-mono">
                        {formatCurrency(selectedCourse.price)}
                      </Badge>
                      <Badge variant={selectedCourse.isActive ? "success" : "destructive"}>
                        {selectedCourse.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedCourse.description}</p>
                  <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex justify-between items-center">
                    <span>Course Enrolment count: {selectedCourse.enrolledCount} enrolled</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Demos Sidebar list (Right side) */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Available Demos</h3>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {demoCourses.map((course) => {
                const isSelected = selectedCourse?.id === course.id;
                return (
                  <Card
                    key={course.id}
                    className={`cursor-pointer transition-all duration-200 border hover:border-cyan-500/40 shadow-sm ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-950/10 ring-1 ring-cyan-500"
                        : "border-border/60 hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedCourse(course)}
                  >
                    <CardContent className="p-4 flex gap-3 items-start">
                      <div
                        className={`h-9 w-9 rounded-lg shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? "bg-cyan-950 text-cyan-400 border border-cyan-500/30" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Play className={`h-4 w-4 ${isSelected ? "fill-cyan-400/20" : ""}`} />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{course.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
