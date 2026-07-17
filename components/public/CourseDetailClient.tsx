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
  const hasPrice = Number.isFinite(price) && price > 0;

  return (
    <div className="sticky top-24 border border-swiss-black/10 bg-swiss-white p-6">
      <div className="mb-4 aspect-video overflow-hidden bg-gradient-to-br from-swiss-red/15 to-swiss-black">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={courseTitle} className="h-full w-full object-cover" />
        ) : null}
      </div>
      {hasPrice ? (
        <>
          <p className="text-4xl font-bold tracking-[-0.03em] text-swiss-red">
            ₹{price.toLocaleString("en-IN")}
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-swiss-muted">
            per slot · one-time payment
          </p>
        </>
      ) : null}

      <ul className="mt-4 space-y-2 text-sm text-swiss-muted border-t border-swiss-black/10 pt-4">
        <li>✓ All live class links</li>
        <li>✓ Lifetime access to recordings</li>
        <li>✓ Course completion certificate</li>
        <li>✓ Access to Job Portal</li>
      </ul>

      <div className="mt-6">
        {hasPrice ? (
          <EnrollmentFlow
            courseId={courseId}
            courseTitle={courseTitle}
            price={price}
            trigger={
              <Button className="w-full py-6 text-base">
                Enroll Now
              </Button>
            }
          />
        ) : (
          <Button className="w-full py-6 text-base" disabled>
            Enrollment unavailable
          </Button>
        )}
      </div>

      {hasPrice ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-swiss-muted">
          <Shield className="h-4 w-4 text-swiss-red" />
          30-day refund policy
        </p>
      ) : null}
    </div>
  );
}
