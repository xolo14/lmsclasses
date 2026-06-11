"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ExternalLink, Play, Film, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type Course = {
  id: string;
  title: string;
  description: string;
  price: string;
  demoUrl?: string | null;
  isActive: boolean;
  enrolledCount: number;
};

export function DemosPage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isDirectVideo, setIsDirectVideo] = useState(false);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["demos-courses"],
    queryFn: async () => {
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

  // Parse embed URL when the selected course changes
  useEffect(() => {
    if (!selectedCourse || !selectedCourse.demoUrl) {
      setEmbedUrl(null);
      setIsDirectVideo(false);
      return;
    }

    const trimmedUrl = selectedCourse.demoUrl.trim();

    // YouTube regex
    const ytReg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const ytMatch = trimmedUrl.match(ytReg);
    if (ytMatch && ytMatch[2].length === 11) {
      setEmbedUrl(`https://www.youtube.com/embed/${ytMatch[2]}?autoplay=1`);
      setIsDirectVideo(false);
      return;
    }

    // Vimeo regex
    const vimeoReg = /vimeo\.com\/(?:video\/)?([0-9]+)/;
    const vimeoMatch = trimmedUrl.match(vimeoReg);
    if (vimeoMatch) {
      setEmbedUrl(`https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`);
      setIsDirectVideo(false);
      return;
    }

    // Check direct video file types
    const directVideoRegex = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;
    if (directVideoRegex.test(trimmedUrl)) {
      setIsDirectVideo(true);
      setEmbedUrl(trimmedUrl);
      return;
    }

    // Fallback
    setEmbedUrl(null);
    setIsDirectVideo(false);
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
              {selectedCourse && embedUrl && !isDirectVideo ? (
                <iframe
                  src={embedUrl}
                  title={`Demo video for ${selectedCourse.title}`}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : selectedCourse && isDirectVideo && embedUrl ? (
                <video
                  key={selectedCourse.id}
                  src={embedUrl}
                  controls
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : selectedCourse ? (
                <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                  <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center mb-4 text-cyan-400">
                    <ExternalLink className="h-8 w-8" />
                  </div>
                  <p className="text-base text-slate-300 font-medium mb-2">External Demo URL</p>
                  <p className="text-sm text-slate-400 mb-6">
                    This demo video is hosted externally and cannot be embedded directly in the player.
                  </p>
                  <Button
                    asChild
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold shadow-lg shadow-cyan-500/10 flex items-center gap-2"
                  >
                    <a href={selectedCourse.demoUrl || ""} target="_blank" rel="noopener noreferrer">
                      <span>Open Demo Video</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
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
