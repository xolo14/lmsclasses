"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { courseSchema, type CourseInput } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "live" | "record";
  course?: { id: string; title: string; description?: string | null; price: string; demoUrl?: string | null; duration?: string | null };
}

export function AddCourseModal({ open, onOpenChange, type, course }: AddCourseModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const formValues = useMemo<CourseInput>(
    () =>
      course
        ? {
            title: course.title,
            description: course.description ?? "",
            price: Number(course.price),
            demoUrl: course.demoUrl ?? "",
            duration: course.duration ?? "",
            courseType: type,
          }
        : {
            title: "",
            description: "",
            price: 0,
            demoUrl: "",
            duration: "",
            courseType: type,
          },
    [course, type]
  );

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    values: formValues,
  });

  useEffect(() => {
    if (open) {
      reset(formValues);
      setError("");
    }
  }, [open, formValues, reset]);

  const mutation = useMutation({
    mutationFn: async (data: CourseInput) => {
      const url = course ? `/api/${type}-courses/${course.id}` : `/api/${type}-courses`;
      const res = await fetch(url, {
        method: course ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save course");
      return res.json();
    },
    onSuccess: () => {
      const targetKey = type === "live" ? "live-courses" : "record-courses";
      queryClient.invalidateQueries({ queryKey: [targetKey] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      if (!course) reset({ title: "", description: "", price: 0, demoUrl: "", duration: "", courseType: type });
      onOpenChange(false);
    },
    onError: () => setError("Failed to save course"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{course ? "Edit Course" : `Add ${type === "live" ? "Live" : "Record"} Course`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...register("description")} />
          </div>
          <div className="space-y-2">
            <Label>Price (₹)</Label>
            <Input type="number" {...register("price")} />
            {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Duration (e.g. 12 weeks, 40 hours)</Label>
            <Input {...register("duration")} placeholder="12 weeks" />
            {errors.duration && <p className="text-sm text-destructive">{errors.duration.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Demo URL</Label>
            <Input {...register("demoUrl")} placeholder="https://..." />
            {errors.demoUrl && <p className="text-sm text-destructive">{errors.demoUrl.message}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
