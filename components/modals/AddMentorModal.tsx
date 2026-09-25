"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mentorSchema, editMentorSchema } from "@/lib/validations";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

type EditMentorInput = z.infer<typeof editMentorSchema>;

export type MentorUserRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  courseId?: string | null;
  courseIds?: string[];
  courseTitle?: string | null;
  courseTitles?: string[];
};

interface AddMentorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiPath?: string;
  title?: string;
  user?: MentorUserRow;
  allowMultipleCourses?: boolean;
}

type LiveCourseOption = {
  id: string;
  title: string;
  isActive?: boolean;
};

export function AddMentorModal({
  open,
  onOpenChange,
  apiPath = "/api/mentors",
  title = "Add Mentor",
  user,
  allowMultipleCourses = false,
}: AddMentorModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isEdit = !!user;

  // Fetch all live courses for assignment
  const { data: courses = [] } = useQuery<LiveCourseOption[]>({
    queryKey: ["live-courses"],
    queryFn: async () => {
      const res = await fetch("/api/live-courses");
      const data = await res.json();
      return Array.isArray(data) ? data.filter((c) => c.isActive !== false) : [];
    },
    enabled: open,
  });

  const formValues = useMemo<EditMentorInput>(
    () =>
      user
        ? {
            name: user.name,
            email: user.email,
            phone: user.phone ?? "",
            courseId: user.courseIds?.[0] || user.courseId || "",
            courseIds: user.courseIds?.length
              ? user.courseIds
              : user.courseId
                ? [user.courseId]
                : [],
            password: "",
            confirmPassword: "",
          }
        : {
            name: "",
            email: "",
            phone: "",
            courseId: "",
            courseIds: [],
            password: "",
            confirmPassword: "",
          },
    [user]
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditMentorInput>({
    resolver: zodResolver(isEdit ? editMentorSchema : mentorSchema),
    values: formValues,
  });

  const selectedCourseId = watch("courseId") || "";
  const selectedCourseIds = watch("courseIds") || [];
  const existingCount = user?.courseIds?.length
    ? user.courseIds.length
    : user?.courseId
      ? 1
      : 0;
  const managerLockedMulti = !allowMultipleCourses && existingCount > 1;

  useEffect(() => {
    if (open) {
      reset(formValues);
      setError("");
    }
  }, [open, formValues, reset]);

  const mutation = useMutation({
    mutationFn: async (data: EditMentorInput) => {
      const url = isEdit ? `${apiPath}/${user!.id}` : apiPath;
      const method = isEdit ? "PATCH" : "POST";
      const coursePayload = managerLockedMulti
        ? {}
        : {
            courseIds: allowMultipleCourses
              ? data.courseIds ?? []
              : data.courseId
                ? [data.courseId]
                : [],
            courseId: allowMultipleCourses
              ? (data.courseIds?.[0] ?? null)
              : data.courseId
                ? data.courseId
                : null,
          };
      const payload = isEdit
        ? {
            name: data.name,
            email: data.email,
            phone: data.phone,
            ...coursePayload,
            ...(data.password ? { password: data.password } : {}),
          }
        : {
            ...data,
            ...coursePayload,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save mentor");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentors"] });
      if (!isEdit) {
        reset({ name: "", email: "", phone: "", courseId: "", courseIds: [], password: "", confirmPassword: "" });
      }
      onOpenChange(false);
    },
    onError: (err) => setError(err.message),
  });

  const dialogTitle = isEdit ? title.replace("Add", "Edit") : title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register("name")} placeholder="Full Name" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register("email")} placeholder="mentor@example.com" />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input {...register("phone")} placeholder="+91 9876543210" />
          </div>

          <div className="space-y-2">
            <Label>{allowMultipleCourses ? "Assign Courses (Optional)" : "Assign Course (Optional)"}</Label>
            {allowMultipleCourses ? (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No live courses available.</p>
                ) : (
                  courses.map((c) => {
                    const checked = selectedCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? selectedCourseIds.filter((id) => id !== c.id)
                              : [...selectedCourseIds, c.id];
                            setValue("courseIds", next, { shouldValidate: true });
                            setValue("courseId", next[0] ?? "", { shouldValidate: true });
                          }}
                        />
                        <span>{c.title}</span>
                      </label>
                    );
                  })
                )}
              </div>
            ) : managerLockedMulti ? (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                <p>{(user?.courseTitles ?? []).join(", ") || user?.courseTitle}</p>
                <p className="text-xs text-muted-foreground">
                  This mentor already has multiple Super Admin courses. A manager cannot add more.
                </p>
              </div>
            ) : (
              <Select
                value={selectedCourseId || "none"}
                onValueChange={(val) => {
                  const next = val === "none" ? "" : val;
                  setValue("courseId", next, { shouldValidate: true });
                  setValue("courseIds", next ? [next] : [], { shouldValidate: true });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a Live Course (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No Course Assigned --</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              {allowMultipleCourses
                ? "Super Admin can assign more than one live course."
                : "Managers can assign only one live course."}
            </p>
            {errors.courseId && <p className="text-sm text-destructive">{errors.courseId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>{isEdit ? "New password (leave blank to keep current)" : "Password"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                className="pr-10"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{isEdit ? "Confirm new password" : "Confirm Password"}</Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                className="pr-10"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
