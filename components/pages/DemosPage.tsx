"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Play, AlertCircle, Link2, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmbeddedVideoPlayer } from "@/components/ui/embedded-video-player";
import { resolveVideoEmbed, type ResolvedVideoEmbed } from "@/lib/video-embed";

type Course = {
  id: string;
  title: string;
  description: string;
  price: string;
  demoUrl?: string | null;
  demoVideoUrl?: string | null;
  isActive: boolean;
  enrolledCount: number;
};

function courseDemoUrl(c: Pick<Course, "demoUrl" | "demoVideoUrl">) {
  return (c.demoVideoUrl || c.demoUrl || "").trim();
}

interface DemosPageProps {
  /** Org admin: live courses only. Super admin: all course types. */
  liveOnly?: boolean;
}

function getDemoShareUrl(courseId: string) {
  if (typeof window === "undefined") return `/demo/${courseId}`;
  return `${window.location.origin}/demo/${courseId}`;
}

export function DemosPage({ liveOnly = false }: DemosPageProps) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [embed, setEmbed] = useState<ResolvedVideoEmbed | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const demoCourses = courses
    .map((c) => ({ ...c, demoUrl: courseDemoUrl(c) || null }))
    .filter((c) => c.demoUrl);

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

  const copyShareLink = async (courseId: string) => {
    const url = getDemoShareUrl(courseId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(courseId);
      window.setTimeout(() => setCopiedId((id) => (id === courseId ? null : id)), 2000);
    } catch {
      window.prompt("Copy this demo link:", url);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-pulse text-lg font-medium text-muted-foreground">
          Loading Course Demos...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Demos"
        description="Watch interactive course demo videos and walkthroughs. Copy a share link to send to interested students."
      />

      {demoCourses.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="mb-1 text-lg font-semibold text-foreground">No Demos Available</p>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              None of the courses have a demo video set. Add a &quot;Demo URL&quot; to a course to
              display it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-3">
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-bold text-foreground">{selectedCourse.title}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-swiss-red/30 bg-swiss-red/5 font-mono text-swiss-red"
                      >
                        {formatCurrency(selectedCourse.price)}
                      </Badge>
                      <Badge variant={selectedCourse.isActive ? "success" : "destructive"}>
                        {selectedCourse.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => void copyShareLink(selectedCourse.id)}
                      >
                        {copiedId === selectedCourse.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Link2 className="h-3.5 w-3.5" />
                            Copy share link
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selectedCourse.description}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                    <span>Course Enrolment count: {selectedCourse.enrolledCount} enrolled</span>
                    <span className="break-all font-mono text-[11px]">
                      /demo/{selectedCourse.id}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4 lg:col-span-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Available Demos
            </h3>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {demoCourses.map((course) => {
                const isSelected = selectedCourse?.id === course.id;
                return (
                  <Card
                    key={course.id}
                    className={`cursor-pointer border shadow-sm transition-all duration-200 hover:border-swiss-red/40 ${
                      isSelected
                        ? "border-swiss-red bg-swiss-red/5 ring-1 ring-swiss-red"
                        : "border-border/60 hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedCourse(course)}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isSelected
                            ? "border border-swiss-red/30 bg-swiss-red/5 text-swiss-red"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Play className={`h-4 w-4 ${isSelected ? "fill-swiss-red/20" : ""}`} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {course.title}
                        </p>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {course.description}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyShareLink(course.id);
                          }}
                        >
                          {copiedId === course.id ? (
                            <>
                              <Check className="mr-1 h-3 w-3" /> Copied
                            </>
                          ) : (
                            <>
                              <Link2 className="mr-1 h-3 w-3" /> Share
                            </>
                          )}
                        </Button>
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
