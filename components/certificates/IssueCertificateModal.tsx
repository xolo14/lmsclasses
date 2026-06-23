"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type TemplateRow = {
  id: string;
  name: string;
  courseId: string | null;
  courseType: string | null;
  courseTitle?: string | null;
};

type StudentRow = {
  id: string;
  name: string;
  email: string;
  completionPercentage: number;
  enrolledAt?: string | null;
  durationEligible?: boolean;
  eligibleAt?: string | null;
};

function formatApiError(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed";
  if ("error" in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "formErrors" in err) {
      const formErrors = (err as { formErrors?: string[] }).formErrors;
      if (formErrors?.length) return formErrors.join(", ");
    }
  }
  return "Request failed";
}

export function IssueCertificateModal({
  open,
  onOpenChange,
  template,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateRow;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const courseId = template.courseId ?? "";
  const courseType = (template.courseType as "live" | "record" | null) ?? null;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    setSelected(new Set());
    setResults([]);
    setError(null);
  }, [template, open]);

  const {
    data: students = [],
    isLoading: loadingStudents,
    error: studentsError,
    refetch: refetchStudents,
  } = useQuery<StudentRow[]>({
    queryKey: ["cert-students", courseId, courseType, template.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/certificates/enrolled-students?courseId=${courseId}&courseType=${courseType}&templateId=${template.id}&eligibleOnly=true`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data));
      if (!Array.isArray(data)) throw new Error("Could not load enrolled students");
      return data;
    },
    enabled: open && !!courseId && !!courseType,
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(students.map((s) => s.id)));
  };

  const issue = async () => {
    if (!courseId || !courseType) {
      setError("This template is not linked to a course.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one student.");
      return;
    }

    setIssuing(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/certificates/issued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          templateId: template.id,
          studentIds: [...selected],
          courseId,
          courseType,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(formatApiError(data));
        return;
      }

      const messages: string[] = [];
      for (const id of data.issued ?? []) {
        const s = students.find((x) => x.id === id);
        messages.push(`Issued: ${s?.name ?? id}`);
      }
      for (const id of data.skipped ?? []) {
        const s = students.find((x) => x.id === id);
        messages.push(`Skipped (already issued): ${s?.name ?? id}`);
      }
      for (const f of data.failed ?? []) {
        const studentId = typeof f === "string" ? f : f.studentId;
        const message = typeof f === "string" ? "Failed" : f.message;
        const s = students.find((x) => x.id === studentId);
        messages.push(`Failed: ${s?.name ?? studentId} — ${message}`);
      }

      setResults(messages);

      if ((data.issued?.length ?? 0) > 0) {
        onSuccess();
        setSelected(new Set());
        void refetchStudents();
        void queryClient.invalidateQueries({ queryKey: ["cert-students", courseId, courseType, template.id] });
      } else if ((data.failed?.length ?? 0) > 0) {
        setError("No certificates were issued. See details below.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Issue request failed");
    } finally {
      setIssuing(false);
    }
  };

  const courseLabel = template.courseTitle
    ? `[${courseType}] ${template.courseTitle}`
    : courseType && courseId
      ? `[${courseType}] ${courseId}`
      : "Not linked";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue certificates — {template.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!courseId || !courseType ? (
            <p className="text-sm text-destructive">
              Link this template to a course in the template editor before issuing certificates.
            </p>
          ) : (
            <>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <Label className="text-xs text-muted-foreground">Course</Label>
                <p className="text-sm font-medium">{courseLabel}</p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {loadingStudents ? (
                <p className="text-sm text-muted-foreground">Loading students without certificates…</p>
              ) : studentsError ? (
                <p className="text-sm text-destructive">
                  {studentsError instanceof Error ? studentsError.message : "Failed to load students"}
                </p>
              ) : students.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All enrolled students already have this certificate, or no enrollments exist for this course.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {students.length} student(s) not yet issued
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={selectAll}>
                      Select all
                    </Button>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-border p-2">
                    {students.map((s) => (
                      <label key={s.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(s.id)}
                          onChange={() => toggle(s.id)}
                        />
                        <span>
                          <span className="font-medium">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {s.completionPercentage}% complete
                            {s.enrolledAt ? ` · joined ${format(new Date(s.enrolledAt), "MMM d, yyyy")}` : ""}
                            {s.durationEligible === false && s.eligibleAt
                              ? ` · eligible ${format(new Date(s.eligibleAt), "MMM d, yyyy")}`
                              : ""}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button
                    type="button"
                    disabled={issuing || selected.size === 0}
                    onClick={() => void issue()}
                  >
                    {issuing ? "Issuing..." : `Issue ${selected.size} certificate(s)`}
                  </Button>
                </>
              )}

              {results.length > 0 && (
                <div className="space-y-1 rounded border border-border bg-muted/30 p-3">
                  {results.map((r) => (
                    <p
                      key={r}
                      className={`text-sm ${r.startsWith("Failed") ? "text-destructive" : r.startsWith("Issued") ? "text-emerald-600" : "text-muted-foreground"}`}
                    >
                      {r}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
