"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentSchema, type StudentInput } from "@/lib/validations";
import { formatApiError } from "@/lib/utils";
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
import { SlotExceededModal } from "./SlotExceededModal";
import { generateLmsId } from "@/lib/razorpay";

interface AddStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed course (org-admin). Omit when showCourseSelect is true. */
  courseId?: string;
  courseName?: string;
  /** Super admin / manager: pick organisation before enrolling */
  requireOrganisation?: boolean;
  /** Let user pick course inside the modal (super admin) */
  showCourseSelect?: boolean;
}

export function AddStudentModal({
  open,
  onOpenChange,
  courseId: fixedCourseId,
  courseName: fixedCourseName,
  requireOrganisation,
  showCourseSelect,
}: AddStudentModalProps) {
  const queryClient = useQueryClient();
  const [slotExceeded, setSlotExceeded] = useState(false);
  const [slotInfo, setSlotInfo] = useState({ total: 0, used: 0 });
  const [organisationId, setOrganisationId] = useState("");
  const [pickedCourseId, setPickedCourseId] = useState("");

  const activeCourseId = showCourseSelect ? pickedCourseId : (fixedCourseId ?? "");

  const { data: courses = [] } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await fetch("/api/courses");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !!showCourseSelect,
  });

  const resolvedCourseName =
    fixedCourseName || courses.find((c) => c.id === activeCourseId)?.title;

  const { data: orgs = [] } = useQuery({
    queryKey: ["organisations"],
    queryFn: async () => {
      const res = await fetch("/api/organisations");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !!requireOrganisation,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["batches", activeCourseId],
    queryFn: async () => {
      const res = await fetch(`/api/batches?courseId=${activeCourseId}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !!activeCourseId,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: { courseId: fixedCourseId ?? "", lmsId: generateLmsId() },
  });

  const selectedBatchId = watch("batchId");
  const formCourseId = watch("courseId");

  const mutation = useMutation({
    mutationFn: async (data: StudentInput) => {
      const courseId = data.courseId || activeCourseId;
      if (!courseId) {
        throw new Error("Select a course");
      }
      if (requireOrganisation && !organisationId) {
        throw new Error("Select an organisation");
      }
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          courseId,
          organisationId: organisationId || undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 403 && json.error === "SLOT_EXCEEDED") {
        setSlotInfo({ total: json.totalSlots ?? 0, used: json.usedSlots ?? 0 });
        setSlotExceeded(true);
        throw new Error("SLOT_EXCEEDED");
      }
      if (!res.ok) {
        throw new Error(formatApiError(json.error, "Failed to add student"));
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      const initialCourse = fixedCourseId ?? "";
      setPickedCourseId(initialCourse);
      reset({
        courseId: initialCourse,
        lmsId: generateLmsId(),
        name: "",
        email: "",
        phone: "",
        password: "",
        collegeName: "",
        batchId: undefined,
      });
      setOrganisationId("");
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedCourseId]);

  useEffect(() => {
    if (open && requireOrganisation && orgs.length === 1 && !organisationId) {
      setOrganisationId(orgs[0].id);
    }
  }, [open, requireOrganisation, orgs, organisationId]);

  const handleCourseChange = (id: string) => {
    setPickedCourseId(id);
    setValue("courseId", id, { shouldValidate: true });
    setValue("batchId", undefined);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <input type="hidden" {...register("courseId")} />

            {showCourseSelect && (
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={pickedCourseId} onValueChange={handleCourseChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mutation.isError && mutation.error?.message === "Select a course" && (
                  <p className="text-sm text-destructive">{mutation.error.message}</p>
                )}
                {errors.courseId && (
                  <p className="text-sm text-destructive">{errors.courseId.message}</p>
                )}
              </div>
            )}

            {requireOrganisation && (
              <div className="space-y-2">
                <Label>Organisation</Label>
                <Select onValueChange={setOrganisationId} value={organisationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o: { id: string; name: string }) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {orgs.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No organisations yet. Create one under Organisations first.
                  </p>
                )}
                {mutation.isError && mutation.error?.message === "Select an organisation" && (
                  <p className="text-sm text-destructive">{mutation.error.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Student Name</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label>LMS ID</Label>
              <Input {...register("lmsId")} />
            </div>
            <div className="space-y-2">
              <Label>Password (leave blank to auto-generate)</Label>
              <Input type="password" {...register("password")} />
            </div>
            <div className="space-y-2">
              <Label>College Name</Label>
              <Input {...register("collegeName")} />
            </div>
            <div className="space-y-2">
              <Label>Batch (optional)</Label>
              <Select
                value={selectedBatchId}
                onValueChange={(v) => setValue("batchId", v, { shouldValidate: true })}
                disabled={!activeCourseId && !formCourseId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      activeCourseId ? "Select batch (optional)" : "Select a course first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b: { id: string; name: string }) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.batchId && (
                <p className="text-sm text-destructive">{errors.batchId.message}</p>
              )}
            </div>
            {mutation.isError &&
              mutation.error?.message !== "SLOT_EXCEEDED" &&
              mutation.error?.message !== "Select an organisation" &&
              mutation.error?.message !== "Select a course" && (
                <p className="text-sm text-destructive">{mutation.error.message}</p>
              )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Adding..." : "Add Student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <SlotExceededModal
        open={slotExceeded}
        onOpenChange={setSlotExceeded}
        courseName={resolvedCourseName || "this course"}
        totalSlots={slotInfo.total}
      />
    </>
  );
}
