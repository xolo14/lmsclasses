"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { hrJobSchema, type HrJobInput } from "@/lib/validations";
import { formatApiError, parseApiJson } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function HrLiveJobsPage() {
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["hr-jobs-live"],
    queryFn: () => fetch("/api/hr/jobs/live").then((r) => r.json()),
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<HrJobInput>({
    resolver: zodResolver(hrJobSchema),
    defaultValues: { employmentType: "full_time", openings: 1 },
  });

  const employmentType = watch("employmentType");

  const createJob = useMutation({
    mutationFn: async (payload: HrJobInput) => {
      const res = await fetch("/api/hr/jobs/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await parseApiJson<{ error?: unknown }>(res);
      if (!res.ok) {
        throw new Error(formatApiError(json.error, "Failed to create job"));
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-jobs-live"] });
      reset({ employmentType: "full_time", openings: 1 });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Live Job Postings</h1>
      <Card>
        <CardHeader><CardTitle>New Job Posting</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => createJob.mutate(d))} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1"><Label>Job Title</Label><Input {...register("title")} /></div>
            <div className="space-y-1"><Label>Organization Name</Label><Input {...register("organisationName")} /></div>
            <div className="space-y-1"><Label>Job Location</Label><Input {...register("location")} /></div>
            <div className="space-y-1">
              <Label>Employment Type</Label>
              <Select
                value={employmentType}
                onValueChange={(v) =>
                  setValue("employmentType", v as HrJobInput["employmentType"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internship">Internship</SelectItem>
                  <SelectItem value="full_time">Full time</SelectItem>
                  <SelectItem value="part_time">Part time</SelectItem>
                </SelectContent>
              </Select>
              {errors.employmentType && (
                <p className="text-sm text-destructive">{errors.employmentType.message}</p>
              )}
            </div>
            <div className="space-y-1"><Label>Stipend</Label><Input {...register("stipend")} /></div>
            <div className="space-y-1"><Label>Salary</Label><Input {...register("salary")} /></div>
            <div className="space-y-1"><Label>CTC</Label><Input {...register("ctc")} /></div>
            <div className="space-y-1"><Label>Experience Required</Label><Input {...register("experienceRequired")} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Description</Label><Textarea {...register("description")} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Roles and Responsibilities</Label><Textarea {...register("responsibilities")} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Required Skills</Label><Textarea {...register("requiredSkills")} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Eligibility Criteria</Label><Textarea {...register("eligibilityCriteria")} /></div>
            <div className="space-y-1"><Label>Last Date to Apply</Label><Input type="datetime-local" {...register("lastDateToApply")} /></div>
            <div className="space-y-1"><Label>Application Closing DateTime</Label><Input type="datetime-local" {...register("applicationDeadline")} /></div>
            <div className="space-y-1"><Label>Openings</Label><Input type="number" min={1} {...register("openings")} /></div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createJob.isPending}>{createJob.isPending ? "Publishing..." : "Publish Job"}</Button>
              {createJob.isError && <p className="text-sm text-destructive mt-2">{(createJob.error as Error).message}</p>}
              {errors.title && <p className="text-sm text-destructive mt-2">{errors.title.message}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current Live Jobs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : jobs.length === 0 ? (
            <p className="text-muted-foreground">No active jobs.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job: { id: string; title: string; organisationName: string; location?: string | null }) => (
                <div key={job.id} className="rounded border p-3">
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-muted-foreground">{job.organisationName} · {job.location || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
