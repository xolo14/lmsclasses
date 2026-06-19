"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAssignCoursesMutation } from "@/lib/hooks/useEnrollments";
import type { EnrollmentAccessType } from "@/lib/db/schema";

type CourseOption = {
  id: string;
  title: string;
  type: "live" | "record";
  hasLive: boolean;
  hasRecorded: boolean;
  price: string;
  enrolled?: boolean;
};

type Props = {
  studentId: string;
  onSuccess?: () => void;
  /** Auto-check these course IDs when the form loads (e.g. from org course dialog). */
  preselectedCourseIds?: string[];
};

export function AssignCoursesForm({ studentId, onSuccess, preselectedCourseIds }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [accessType, setAccessType] = useState<EnrollmentAccessType>("both");
  const [isFree, setIsFree] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [batchId, setBatchId] = useState("");
  const [message, setMessage] = useState("");

  const { data: courses = [], isLoading } = useQuery<CourseOption[]>({
    queryKey: ["assignable-courses", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/enrollments/assignable-courses?studentId=${studentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load courses");
      return json.data;
    },
  });

  const mutation = useAssignCoursesMutation(studentId);

  useEffect(() => {
    if (!preselectedCourseIds?.length || !courses.length) return;
    const valid = preselectedCourseIds.filter((id) =>
      courses.some((c) => c.id === id && !c.enrolled)
    );
    if (valid.length) {
      setSelected((prev) => [...new Set([...prev, ...valid])]);
    }
  }, [preselectedCourseIds, courses]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    setMessage("");
    const now = new Date();
    const res = await mutation.mutateAsync({
      courseIds: selected,
      accessType,
      batchId: batchId || null,
      liveAccessFrom: now,
      recordedAccessFrom: now,
      liveAccessUntil: null,
      recordedAccessUntil: null,
      isFree,
      adminNotes: adminNotes || undefined,
    });
    if (res.success) {
      const parts = [
        res.enrolled.length ? `Enrolled: ${res.enrolled.join(", ")}` : "",
        res.skipped.length ? `Skipped: ${res.skipped.join(", ")}` : "",
        res.errors.length ? `Errors: ${res.errors.join("; ")}` : "",
      ].filter(Boolean);
      setMessage(parts.join(" · "));
      setSelected([]);
      onSuccess?.();
    } else {
      setMessage("Assignment failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="swiss-label">Step 1 — Select courses</Label>
        {isLoading ? (
          <p className="text-sm text-swiss-muted mt-2">Loading courses…</p>
        ) : (
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto border border-swiss-black/10 p-3">
            {courses.map((c) => (
              <label
                key={c.id}
                className={`flex items-start gap-3 p-2 cursor-pointer hover:bg-swiss-cream ${
                  c.enrolled ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  disabled={c.enrolled}
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.title}</p>
                  <p className="text-[10px] font-mono text-swiss-muted truncate">{c.id}</p>
                  <p className="text-xs text-swiss-muted">
                    {c.type === "live" ? "Live" : "Recorded"}
                    {c.hasLive && " · LIVE"}
                    {c.hasRecorded && " · REC"}
                    {" · ₹"}
                    {parseFloat(c.price).toLocaleString("en-IN")}
                    {c.enrolled && " · Already enrolled"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Access type</Label>
          <select
            className="mt-1 flex h-10 w-full rounded-sm border border-swiss-black/15 bg-swiss-white px-3 text-sm"
            value={accessType}
            onChange={(e) => setAccessType(e.target.value as EnrollmentAccessType)}
          >
            <option value="live">Live only</option>
            <option value="recorded">Recorded only</option>
            <option value="both">Both</option>
          </select>
        </div>
        {(accessType === "live" || accessType === "both") && (
          <div>
            <Label>Batch ID (live courses)</Label>
            <input
              className="mt-1 flex h-10 w-full rounded-sm border border-swiss-black/15 px-3 text-sm"
              placeholder="Optional — required for org admin live"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        Complimentary (skip slot check)
      </label>

      <div>
        <Label>Admin notes</Label>
        <Textarea className="mt-1" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} />
      </div>

      {message && <p className="text-sm text-swiss-muted">{message}</p>}

      <Button
        disabled={!selected.length || mutation.isPending}
        onClick={submit}
      >
        {mutation.isPending ? "Assigning…" : `Assign ${selected.length} course(s)`}
      </Button>
    </div>
  );
}
