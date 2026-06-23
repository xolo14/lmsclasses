"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TemplateRow = {
  id: string;
  name: string;
  courseId: string | null;
  courseType: string | null;
};

type StudentRow = {
  id: string;
  name: string;
  email: string;
  completionPercentage: number;
  alreadyHasCert?: boolean;
};

export function IssueCertificateModal({
  open,
  onOpenChange,
  template,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateRow;
  onDone: () => void;
}) {
  const [courseId, setCourseId] = useState(template.courseId ?? "");
  const [courseType, setCourseType] = useState<"live" | "record">(
    (template.courseType as "live" | "record") ?? "record"
  );
  useEffect(() => {
    if (template.courseId) {
      setCourseId(template.courseId);
      setCourseType((template.courseType as "live" | "record") ?? "record");
    }
  }, [template]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issuing, setIssuing] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const { data: students = [] } = useQuery<StudentRow[]>({
    queryKey: ["cert-students", courseId, courseType, template.id],
    queryFn: () =>
      fetch(
        `/api/certificates/enrolled-students?courseId=${courseId}&courseType=${courseType}&templateId=${template.id}`
      ).then((r) => r.json()),
    enabled: open && !!courseId,
  });

  const eligible = students.filter((s) => !s.alreadyHasCert);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const issue = async () => {
    setIssuing(true);
    setResults([]);
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
    setIssuing(false);
    if (data.issued) {
      setResults(
        data.issued.map((id: string) => {
          const s = students.find((x) => x.id === id);
          return `✓ ${s?.name ?? id}`;
        })
      );
    }
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue certificates — {template.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!template.courseId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Course ID</Label>
                <input
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  placeholder="Course UUID"
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={courseType} onValueChange={(v) => setCourseType(v as "live" | "record")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="record">Record</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {courseId && (
            <>
              <p className="text-sm text-muted-foreground">
                {eligible.length} eligible · {students.length - eligible.length} already issued
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-border p-2">
                {students.map((s) => (
                  <label key={s.id} className={`flex items-center gap-2 text-sm ${s.alreadyHasCert ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      disabled={s.alreadyHasCert}
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">({s.completionPercentage}%)</span>
                  </label>
                ))}
              </div>
              <Button
                disabled={issuing || selected.size === 0}
                onClick={() => void issue()}
              >
                {issuing ? "Issuing..." : `Issue ${selected.size} certificate(s)`}
              </Button>
              {results.map((r) => (
                <p key={r} className="text-sm text-emerald-600">{r}</p>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
