"use client";

import { EnrollmentFlow } from "@/components/public/EnrollmentFlow";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

interface CourseDetailClientProps {
  courseId: string;
  courseTitle: string;
  price: number;
  thumbnailUrl?: string | null;
}

export function EnrollmentCard({ courseId, courseTitle, price, thumbnailUrl }: CourseDetailClientProps) {
  return (
    <div className="sticky top-24 rounded-xl border border-bg-border bg-bg-card p-6">
      <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-brand-cyan-dim/30 to-bg-base">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={courseTitle} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <p className="text-3xl font-bold text-brand-cyan">₹{price.toLocaleString("en-IN")}</p>
      <p className="text-sm text-text-muted">per slot · one-time payment</p>

      <ul className="mt-4 space-y-2 text-sm text-text-secondary">
        <li>✓ All live class links</li>
        <li>✓ Lifetime access to recordings</li>
        <li>✓ Course completion certificate</li>
        <li>✓ Access to Job Portal</li>
      </ul>

      <div className="mt-6">
        <EnrollmentFlow
          courseId={courseId}
          courseTitle={courseTitle}
          price={price}
          trigger={
            <Button className="w-full bg-brand-cyan py-6 text-base font-semibold text-bg-base hover:bg-brand-cyan-light">
              Enroll Now
            </Button>
          }
        />
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-text-muted">
        <Shield className="h-4 w-4 text-brand-cyan" />
        30-day refund policy
      </p>
    </div>
  );
}
