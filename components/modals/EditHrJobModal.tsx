"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hrJobSchema, type HrJobInput } from "@/lib/validations";
import { formatApiError, parseApiJson, toDatetimeLocalValue } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HrJobFormFields } from "@/components/hr/HrJobFormFields";

export type HrJobRecord = {
  id: string;
  title: string;
  organisationName: string;
  location: string | null;
  employmentType: HrJobInput["employmentType"];
  stipend: string | null;
  salary: string | null;
  ctc: string | null;
  experienceRequired: string | null;
  description: string;
  responsibilities: string | null;
  requiredSkills: string | null;
  eligibilityCriteria: string | null;
  lastDateToApply: string | Date | null;
  applicationDeadline: string | Date;
  openings: number | null;
};

type EditHrJobModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: HrJobRecord | null;
};

export function EditHrJobModal({ open, onOpenChange, job }: EditHrJobModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<HrJobInput>({
    resolver: zodResolver(hrJobSchema),
    defaultValues: { employmentType: "full_time", openings: 1 },
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = form;

  useEffect(() => {
    if (job && open) {
      reset({
        title: job.title,
        organisationName: job.organisationName,
        location: job.location ?? "",
        employmentType: job.employmentType,
        stipend: job.stipend ?? "",
        salary: job.salary ?? "",
        ctc: job.ctc ?? "",
        experienceRequired: job.experienceRequired ?? "",
        description: job.description,
        responsibilities: job.responsibilities ?? "",
        requiredSkills: job.requiredSkills ?? "",
        eligibilityCriteria: job.eligibilityCriteria ?? "",
        applicationDeadline: toDatetimeLocalValue(job.applicationDeadline),
        openings: job.openings ?? 1,
      });
    }
  }, [job, open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: HrJobInput) => {
      const res = await fetch(`/api/hr/jobs/${job!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await parseApiJson<{ error?: unknown }>(res);
      if (!res.ok) {
        throw new Error(formatApiError(json.error, "Failed to update job"));
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-jobs-live"] });
      queryClient.invalidateQueries({ queryKey: ["hr-jobs-previous"] });
      onOpenChange(false);
    },
  });

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job Posting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <HrJobFormFields
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
          />
          {mutation.isError && (
            <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
