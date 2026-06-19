"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type StudentOption = {
  id: string;
  name: string;
  email: string;
  lmsId: string;
  courseTitle?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. `/super-admin/students` or `/org-admin/students` */
  assignBasePath: string;
  /** When set, the assign page opens with this course pre-selected. */
  courseId?: string;
  title?: string;
  description?: string;
};

export function SelectStudentForAssignModal({
  open,
  onOpenChange,
  assignBasePath,
  courseId,
  title = "Assign courses to student",
  description = "Select an existing student to assign one or more courses.",
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: students = [], isLoading } = useQuery<StudentOption[]>({
    queryKey: ["students-for-assign"],
    queryFn: async () => {
      const res = await fetch("/api/students?limit=100");
      const json = await res.json();
      if (!res.ok) throw new Error("Failed to load students");
      const rows: StudentOption[] = Array.isArray(json) ? json : json.data ?? [];
      const byId = new Map<string, StudentOption>();
      for (const row of rows) {
        const existing = byId.get(row.id);
        if (!existing) {
          byId.set(row.id, row);
          continue;
        }
        if (row.courseTitle && row.courseTitle !== "—" && existing.courseTitle !== row.courseTitle) {
          const titles = [existing.courseTitle, row.courseTitle].filter(
            (t) => t && t !== "—"
          ) as string[];
          byId.set(row.id, { ...existing, courseTitle: [...new Set(titles)].join(", ") });
        }
      }
      return Array.from(byId.values());
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.lmsId.toLowerCase().includes(q)
    );
  }, [students, search]);

  const pick = (studentId: string) => {
    onOpenChange(false);
    setSearch("");
    const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
    router.push(`${assignBasePath}/${studentId}/courses${qs}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search by name, email, or LMS ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="max-h-72 overflow-y-auto border border-swiss-black/10 divide-y divide-swiss-black/10">
          {isLoading ? (
            <p className="p-4 text-sm text-swiss-muted">Loading students…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-swiss-muted">No students found.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className="w-full text-left p-3 hover:bg-swiss-cream transition-colors"
              >
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-swiss-muted">
                  {s.lmsId} · {s.email}
                  {s.courseTitle && s.courseTitle !== "—" ? ` · ${s.courseTitle}` : ""}
                </p>
              </button>
            ))
          )}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
