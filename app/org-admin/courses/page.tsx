"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuySlotModal } from "@/components/modals/BuySlotModal";
import { formatCurrency } from "@/lib/utils";

type Course = {
  id: string;
  title: string;
  description: string;
  price: string;
  thumbnailUrl: string;
};

export default function OrgAdminCoursesPage() {
  const [buyCourse, setBuyCourse] = useState<Course | null>(null);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: () => fetch("/api/courses").then((r) => r.json()),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Courses</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.filter((c) => c).map((course) => (
            <CourseCard key={course.id} course={course} onBuy={() => setBuyCourse(course)} />
          ))}
        </div>
      </div>
      {buyCourse && (
        <BuySlotModal
          open={!!buyCourse}
          onOpenChange={(open) => !open && setBuyCourse(null)}
          course={buyCourse}
        />
      )}
    </>
  );
}

function CourseCard({ course, onBuy }: { course: Course; onBuy: () => void }) {
  const { data: slotInfo } = useQuery({
    queryKey: ["slots", course.id],
    queryFn: () => fetch(`/api/slots/${course.id}`).then((r) => r.json()),
  });

  return (
    <Card>
      {course.thumbnailUrl && (
        <div className="h-40 overflow-hidden rounded-t-xl">
          <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-lg">{course.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
        <p className="font-mono text-primary mb-3">{formatCurrency(course.price)} / slot</p>
        {slotInfo && slotInfo.totalSlots > 0 && (
          <Badge variant="success" className="mb-3">
            {slotInfo.remaining} slots remaining
          </Badge>
        )}
        <Button className="w-full" onClick={onBuy}>Buy Now</Button>
      </CardContent>
    </Card>
  );
}
