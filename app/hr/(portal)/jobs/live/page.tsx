"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { hrJobSchema, type HrJobInput } from "@/lib/validations";
import { formatApiError, formatDateTime, parseApiJson } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HrJobFormFields } from "@/components/hr/HrJobFormFields";
import { EditHrJobModal, type HrJobRecord } from "@/components/modals/EditHrJobModal";
import { Pencil, Trash2, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HrLiveJobsPage() {
  const queryClient = useQueryClient();
  const [editingJob, setEditingJob] = useState<HrJobRecord | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState("");

  const { data: jobs = [], isLoading } = useQuery<HrJobRecord[]>({
    queryKey: ["hr-jobs-live"],
    queryFn: () => fetch("/api/hr/jobs/live").then((r) => r.json()),
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<HrJobInput>({
    resolver: zodResolver(hrJobSchema),
    defaultValues: { employmentType: "full_time", openings: 1 },
  });

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

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/hr/jobs/${jobId}`, { method: "DELETE" });
      const json = await parseApiJson<{ error?: unknown }>(res);
      if (!res.ok) {
        throw new Error(formatApiError(json.error, "Failed to delete job"));
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-jobs-live"] });
      queryClient.invalidateQueries({ queryKey: ["hr-jobs-previous"] });
    },
  });

  const importFromUrl = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/hr/jobs/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await parseApiJson<{ error?: unknown; draft?: HrJobInput }>(res);
      if (!res.ok || !json.draft) {
        throw new Error(formatApiError(json.error, "Could not import that page"));
      }
      return json.draft;
    },
    onSuccess: (draft) => {
      setImportError("");
      const fields: (keyof HrJobInput)[] = [
        "title",
        "organisationName",
        "location",
        "employmentType",
        "stipend",
        "salary",
        "ctc",
        "experienceRequired",
        "description",
        "responsibilities",
        "requiredSkills",
        "eligibilityCriteria",
        "applicationDeadline",
        "openings",
      ];
      for (const key of fields) {
        const value = draft[key];
        if (value !== undefined && value !== null && value !== "") {
          setValue(key, value as never, { shouldValidate: true });
        }
      }
    },
    onError: (err) => {
      setImportError(err instanceof Error ? err.message : "Could not import that page.");
    },
  });

  const handleDelete = (job: HrJobRecord) => {
    const ok = window.confirm(
      `Delete "${job.title}"? It will move to Previous Job Postings and stop accepting applications.`
    );
    if (ok) deleteJob.mutate(job.id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Live Job Postings</h1>
      <Card>
        <CardHeader><CardTitle>New Job Posting</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-6 space-y-2 rounded-md border p-3">
            <Label>Import from a public job page</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://company.com/careers/job-posting"
              />
              <Button
                type="button"
                variant="outline"
                disabled={importFromUrl.isPending || !importUrl.trim()}
                onClick={() => importFromUrl.mutate(importUrl.trim())}
              >
                <LinkIcon className="mr-1 h-4 w-4" />
                {importFromUrl.isPending ? "Reading..." : "Fill form"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Reads schema.org JobPosting on a public careers page. Review the fields, then publish.
              Login-only boards (LinkedIn, Naukri) cannot be imported.
            </p>
            {(importError || importFromUrl.isError) && (
              <p className="text-sm text-destructive">{importError || (importFromUrl.error as Error).message}</p>
            )}
          </div>
          <form onSubmit={handleSubmit((d) => createJob.mutate(d))} className="space-y-4">
            <HrJobFormFields
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
            />
            <div>
              <Button type="submit" disabled={createJob.isPending}>
                {createJob.isPending ? "Publishing..." : "Publish Job"}
              </Button>
              {createJob.isError && (
                <p className="text-sm text-destructive mt-2">{(createJob.error as Error).message}</p>
              )}
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
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.organisationName} · {job.location || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Closes {formatDateTime(job.applicationDeadline)}
                      {job.openings != null ? ` · ${job.openings} opening(s)` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingJob(job)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteJob.isPending}
                      onClick={() => handleDelete(job)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {deleteJob.isError && (
            <p className="text-sm text-destructive mt-2">{(deleteJob.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      <EditHrJobModal
        open={!!editingJob}
        onOpenChange={(open) => !open && setEditingJob(null)}
        job={editingJob}
      />
    </div>
  );
}
