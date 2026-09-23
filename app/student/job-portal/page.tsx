"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StudentJob = {
  id: string;
  title: string;
  organisationName: string;
  location: string | null;
  employmentType?: string;
  experienceRequired: string | null;
  stipend?: string | null;
  salary: string | null;
  ctc: string | null;
  applicationDeadline: string;
};

type StudentJobsResponse = {
  items?: StudentJob[];
  page?: number;
  total?: number;
  totalPages?: number;
  error?: string;
};

export default function StudentJobPortalPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    collegeName: "",
    yearOfStudy: "",
    passedOutYear: "",
    resumeUrl: "",
    linkedinUrl: "",
    portfolioUrl: "",
  });

  const { data, isLoading, refetch } = useQuery<StudentJobsResponse>({
    queryKey: ["student-job-portal", query, page],
    queryFn: () =>
      fetch(`/api/student/job-portal?q=${encodeURIComponent(query)}&page=${page}&pageSize=24`).then((r) => r.json()),
  });
  const jobs = data?.items ?? [];

  const apply = useMutation({
    mutationFn: async () => {
      if (!selectedJobId) throw new Error("Select a job first");
      const res = await fetch("/api/student/job-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Application failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-applications"] });
      setSelectedJobId(null);
      setResumeName("");
      setForm({
        fullName: "",
        email: "",
        phone: "",
        collegeName: "",
        yearOfStudy: "",
        passedOutYear: "",
        resumeUrl: "",
        linkedinUrl: "",
        portfolioUrl: "",
      });
      refetch();
    },
  });

  const uploadResume = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/resume", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Resume upload failed");
      return json as { url: string };
    },
    onSuccess: ({ url }) => setForm((f) => ({ ...f, resumeUrl: url })),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Job Portal</h1>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search jobs/company..."
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
        />
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          {data?.total ?? 0} openings · page {data?.page ?? 1} of {data?.totalPages ?? 1}
        </p>
      </div>

      {data?.error ? (
        <Card><CardContent className="py-10 text-center text-destructive">{data.error}</CardContent></Card>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No active jobs found.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.id} className={selectedJobId === job.id ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <CardTitle className="text-base">{job.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{job.organisationName} · {job.location || "—"}</p>
                <p className="text-sm">Experience: {job.experienceRequired || "—"}</p>
                <p className="text-sm">
                  {job.employmentType === "internship"
                    ? `Stipend: ${job.stipend || "—"}`
                    : job.employmentType === "part_time"
                    ? `Salary per Month: ${job.salary || "—"}`
                    : `CTC: ${job.ctc || "—"}`}
                </p>
                <p className="text-sm">Last Date: {formatDate(job.applicationDeadline)}</p>
                <Button size="sm" onClick={() => setSelectedJobId(job.id)}>Apply Now</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(data?.totalPages ?? 1) > 1 ? (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <Dialog open={!!selectedJobId} onOpenChange={(open) => !open && setSelectedJobId(null)}>
        <DialogContent className="max-w-2xl max-h-[min(90dvh,90vh)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for Job</DialogTitle>
            <DialogDescription>
              Provide your details and upload your resume to apply.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2 mt-4">
            {[
              ["Full Name", "fullName"],
              ["Email", "email"],
              ["Phone Number", "phone"],
              ["College Name", "collegeName"],
              ["Current Year", "yearOfStudy"],
              ["Passed Out Year", "passedOutYear"],
              ["LinkedIn URL", "linkedinUrl"],
              ["Portfolio URL", "portfolioUrl"],
            ].map(([label, key]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1 md:col-span-2">
              <Label>Resume (PDF/DOC/DOCX, max 10MB)</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setResumeName(file.name);
                  uploadResume.mutate(file);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {uploadResume.isPending
                  ? "Uploading resume..."
                  : form.resumeUrl
                    ? `Uploaded: ${resumeName}`
                    : "No resume uploaded yet"}
              </p>
              {uploadResume.isError && (
                <p className="text-xs text-destructive">{(uploadResume.error as Error).message}</p>
              )}
            </div>
            <div className="md:col-span-2 mt-4 flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setSelectedJobId(null)}>
                Cancel
              </Button>
              <Button onClick={() => apply.mutate()} disabled={apply.isPending || uploadResume.isPending || !form.resumeUrl}>
                {apply.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
            {apply.isError && <p className="text-sm text-destructive md:col-span-2 mt-2">{(apply.error as Error).message}</p>}
            {apply.isSuccess && <p className="text-sm text-emerald-500 md:col-span-2 mt-2">Application submitted!</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

