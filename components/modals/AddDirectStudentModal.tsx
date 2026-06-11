"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DirectStudentSchema,
  type DirectStudentInput,
} from "@/lib/validations/super-admin-student";

interface AddDirectStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type CourseOption = { id: string; title: string; price: string; isActive: boolean; duration?: string | null; type: "live" | "record" };
type BatchOption = { id: string; name: string; courseId: string; organisationId: string | null };

export function AddDirectStudentModal({ isOpen, onClose, onSuccess }: AddDirectStudentModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<DirectStudentInput>({
    resolver: zodResolver(DirectStudentSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      collegeName: "",
      directEnrollment: true,
    },
  });

  const courseId = form.watch("courseId");

  const { data: courses = [] } = useQuery<CourseOption[]>({
    queryKey: ["courses-for-direct-student"],
    queryFn: async () => {
      const [liveRes, recordRes] = await Promise.all([
        fetch("/api/live-courses"),
        fetch("/api/record-courses"),
      ]);
      if (!liveRes.ok || !recordRes.ok) throw new Error("Failed to load courses");
      const [liveData, recordData] = await Promise.all([
        liveRes.json(),
        recordRes.json(),
      ]);
      const mappedLive = (Array.isArray(liveData) ? liveData : []).map((c: any) => ({ ...c, type: "live" }));
      const mappedRecord = (Array.isArray(recordData) ? recordData : []).map((c: any) => ({ ...c, type: "record" }));
      return [...mappedLive, ...mappedRecord].filter((c: CourseOption) => c.isActive !== false);
    },
    enabled: isOpen,
  });

  const selectedCourse = courses.find((c) => c.id === courseId);
  const isLiveCourse = selectedCourse?.type === "live";

  const { data: batches = [] } = useQuery<BatchOption[]>({
    queryKey: ["batches-for-direct-student", courseId],
    queryFn: async () => {
      const res = await fetch(`/api/batches?courseId=${courseId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isOpen && !!courseId && isLiveCourse,
  });

  useEffect(() => {
    if (!courseId || !isLiveCourse) form.setValue("batchId", undefined);
  }, [courseId, isLiveCourse, form]);

  const onSubmit = async (data: DirectStudentInput) => {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const res = await fetch("/api/super-admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to create student");
      }
      form.reset();
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create student");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Student Directly</DialogTitle>
          <DialogDescription>
            Student will be enrolled without an organisation. No payment required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Student Details</p>

            <div className="space-y-2">
              <Label htmlFor="ds-name">Full Name</Label>
              <Input id="ds-name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-email">Email Address</Label>
              <Input id="ds-email" type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-phone">Phone Number</Label>
              <Input id="ds-phone" {...form.register("phone")} />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-password">Password</Label>
              <div className="relative">
                <Input
                  id="ds-password"
                  type={showPassword ? "text" : "password"}
                  {...form.register("password")}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-confirm">Confirm Password</Label>
              <Input id="ds-confirm" type="password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-college">College / Institution</Label>
              <Input id="ds-college" {...form.register("collegeName")} />
              {form.formState.errors.collegeName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.collegeName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              Enroll in Course (optional)
            </p>

            <div className="space-y-2">
              <Label>Course</Label>
              <Select
                value={courseId ?? ""}
                onValueChange={(v) => form.setValue("courseId", v || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title} — ₹{parseFloat(c.price).toLocaleString("en-IN")}{c.duration ? ` (${c.duration})` : ""} [{c.type === "live" ? "Live" : "Record"}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!courseId && (
              <p className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-muted-foreground">
                ℹ️ Select a course to determine batching options. Live courses support batches for live class access, while record courses are self-paced curriculum.
              </p>
            )}

            {courseId && isLiveCourse && !form.watch("batchId") && (
              <p className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-muted-foreground">
                ℹ️ Without a batch, this student will only access course recordings. To grant live
                class access, select a batch for this course.
              </p>
            )}

            {courseId && !isLiveCourse && (
              <p className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-muted-foreground">
                ℹ️ Record courses do not support batches. The student will have self-paced access to the course recorded curriculum.
              </p>
            )}

            {courseId && isLiveCourse && batches.length > 0 && (
              <div className="space-y-2">
                <Label>Batch</Label>
                <Select
                  value={form.watch("batchId") ?? ""}
                  onValueChange={(v) => form.setValue("batchId", v || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a batch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                        {b.organisationId === null ? " (Direct)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Student"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
