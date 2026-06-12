"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const editStudentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  collegeName: z.string().optional(),
  isActive: z.boolean().optional(),
});

type EditStudentInput = z.infer<typeof editStudentSchema>;

type Student = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  collegeName?: string | null;
  lmsId?: string;
  isActive?: boolean;
};

export function EditStudentModal({
  open,
  onOpenChange,
  student,
  showStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student;
  showStatus?: boolean;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditStudentInput>({
    resolver: zodResolver(editStudentSchema),
  });

  const isActive = watch("isActive");

  useEffect(() => {
    if (student && open) {
      reset({
        name: student.name,
        email: student.email,
        phone: student.phone || "",
        collegeName: student.collegeName || "",
        isActive: student.isActive ?? true,
      });
    }
  }, [student, open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: EditStudentInput) => {
      const res = await fetch(`/api/students/${student!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          collegeName: data.collegeName || null,
          ...(showStatus ? { isActive: data.isActive } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to update student");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
    },
  });

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {student.lmsId && (
            <div className="space-y-2">
              <Label>LMS ID</Label>
              <Input value={student.lmsId} readOnly disabled className="bg-muted" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{String(errors.name.message)}</p>}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{String(errors.email.message)}</p>}
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label>College / Institution (optional)</Label>
            <Input {...register("collegeName")} />
          </div>
          {showStatus && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(v) => setValue("isActive", v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {mutation.isError && (
            <p className="text-sm text-destructive">{mutation.error.message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
