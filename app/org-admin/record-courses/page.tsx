"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuySlotModal } from "@/components/modals/BuySlotModal";
import { DemoVideoModal } from "@/components/modals/DemoVideoModal";
import { formatCurrency } from "@/lib/utils";
import { Film, Play } from "lucide-react";

type Course = {
  id: string;
  title: string;
  description: string;
  price: string;
  demoUrl?: string | null;
};

export default function OrgAdminRecordCoursesPage() {
  const [buyCourse, setBuyCourse] = useState<Course | null>(null);
  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [demoCourseTitle, setDemoCourseTitle] = useState("");
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["record-courses"],
    queryFn: () => fetch("/api/record-courses").then((r) => r.json()),
  });

  const handleWatchDemo = (url: string, title: string) => {
    setDemoVideoUrl(url);
    setDemoCourseTitle(title);
    setDemoModalOpen(true);
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Record Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Purchase seats for record courses, then assign students from Record Students.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.filter((c) => c).map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onBuy={() => setBuyCourse(course)}
              onWatchDemo={handleWatchDemo}
            />
          ))}
        </div>
      </div>
      {buyCourse && (
        <BuySlotModal
          open={!!buyCourse}
          onOpenChange={(open) => !open && setBuyCourse(null)}
          course={buyCourse}
          courseType="record"
          assignStudentsHref="/org-admin/record-students"
        />
      )}
      {demoVideoUrl && (
        <DemoVideoModal
          open={demoModalOpen}
          onOpenChange={setDemoModalOpen}
          videoUrl={demoVideoUrl}
          courseTitle={demoCourseTitle}
        />
      )}
    </>
  );
}

function CourseCard({
  course,
  onBuy,
  onWatchDemo,
}: {
  course: Course;
  onBuy: () => void;
  onWatchDemo: (url: string, title: string) => void;
}) {
  const { data: slotInfo } = useQuery({
    queryKey: ["slots", course.id, "record"],
    queryFn: () => fetch(`/api/slots/${course.id}?type=record`).then((r) => r.json()),
  });

  return (
    <Card>
      <div className="h-28 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between px-6 rounded-t-xl border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-950 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Record Course</p>
            <p className="text-sm font-semibold text-foreground font-sans">Self-paced</p>
          </div>
        </div>
        {course.demoUrl && (
          <Badge variant="secondary" className="bg-violet-950/40 text-violet-400 border border-violet-500/20 text-[10px]">
            Demo Available
          </Badge>
        )}
      </div>
      <CardHeader>
        <CardTitle className="text-lg">{course.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
        <p className="font-mono text-primary mb-3">{formatCurrency(course.price)} / seat</p>
        {slotInfo && slotInfo.totalSlots > 0 && (
          <div className="mb-4">
            <Badge variant="success">{slotInfo.remaining} seats remaining</Badge>
          </div>
        )}
        <div className="flex gap-2">
          {course.demoUrl && (
            <Button
              variant="outline"
              className="flex-1 border-violet-500/30 text-violet-400 hover:text-violet-300 hover:bg-violet-950/20"
              onClick={() => onWatchDemo(course.demoUrl!, course.title)}
            >
              <Play className="h-3 w-3 mr-1 fill-violet-400/20" /> Demo
            </Button>
          )}
          <Button className={course.demoUrl ? "flex-1" : "w-full"} onClick={onBuy}>
            Buy Seats
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
