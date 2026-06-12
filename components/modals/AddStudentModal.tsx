"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentSchema, type StudentInput } from "@/lib/validations";
import { formatApiError, formatDate } from "@/lib/utils";
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
import { Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlotExceededModal } from "./SlotExceededModal";

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
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: { courseId: fixedCourseId ?? "" },
  });

  const selectedBatchId = watch("batchId");
  const formCourseId = watch("courseId");

  const activeCourseId = showCourseSelect
    ? pickedCourseId
    : (fixedCourseId || formCourseId || "");

  const batchOrgScope = requireOrganisation ? organisationId : undefined;

  const { data: courses = [] } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await fetch("/api/live-courses");
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

  const {
    data: batches = [],
    isLoading: batchesLoading,
    isError: batchesError,
    error: batchesFetchError,
  } = useQuery({
    queryKey: ["batches", activeCourseId, batchOrgScope],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeCourseId) params.set("courseId", activeCourseId);
      if (batchOrgScope) params.set("organisationId", batchOrgScope);
      const res = await fetch(`/api/batches?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Failed to load batches"
        );
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !!activeCourseId && (!requireOrganisation || !!organisationId),
  });

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
    onSuccess: (data: { emailSent?: boolean; emailWarning?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      if (data.emailSent === false) {
        setEmailNotice(
          data.emailWarning ??
            "Student created but welcome email was not sent. Check SMTP at /api/health (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT=465)."
        );
        queryClient.invalidateQueries({ queryKey: ["students"] });
        queryClient.invalidateQueries({ queryKey: ["slots"] });
        return;
      }
      setEmailNotice(null);
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      const initialCourse = fixedCourseId ?? "";
      setPickedCourseId(initialCourse);
      reset({
        courseId: initialCourse,
        name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        collegeName: "",
        batchId: undefined,
      });
      setOrganisationId("");
      setEmailNotice(null);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedCourseId]);

  useEffect(() => {
    if (open && activeCourseId) {
      setValue("courseId", activeCourseId, { shouldValidate: true });
    }
  }, [open, activeCourseId, setValue]);

  const handleCourseChange = (id: string) => {
    setPickedCourseId(id);
    setValue("courseId", id, { shouldValidate: true });
    setValue("batchId", "", { shouldValidate: true });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
          </DialogHeader>
          {emailNotice ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
              {emailNotice}
            </p>
          ) : null}
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
              <Label>Password (leave blank to auto-generate)</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  className="pr-10"
                  autoComplete="new-password"
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
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  className="pr-10"
                  autoComplete="new-password"
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
            <div className="space-y-2">
              <Label>College Name (optional)</Label>
              <Input {...register("collegeName")} />
            </div>
            <div className="space-y-2">
              <Label>Batch</Label>
              <Select
                key={`batch-${activeCourseId}`}
                value={selectedBatchId}
                onValueChange={(v) => setValue("batchId", v, { shouldValidate: true })}
                disabled={!activeCourseId || (requireOrganisation && !organisationId)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !activeCourseId
                        ? "Select a course first"
                        : requireOrganisation && !organisationId
                          ? "Select an organisation first"
                          : batchesLoading
                            ? "Loading batches..."
                            : "Select batch"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b: { id: string; name: string; startDate?: string | null }) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.startDate ? ` (${formatDate(b.startDate)})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {batchesLoading && activeCourseId && (
                <p className="text-xs text-muted-foreground">Loading batches for this course...</p>
              )}
              {batchesError && (
                <p className="text-xs text-destructive">
                  {(batchesFetchError as Error)?.message || "Could not load batches."}
                </p>
              )}
              {!batchesLoading && !batchesError && activeCourseId && batches.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No batches for this course yet. Create one with &quot;Create Batch&quot; first.
                </p>
              )}
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
