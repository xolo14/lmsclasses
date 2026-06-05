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

export default function StudentJobPortalPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
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

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["student-job-portal", query],
    queryFn: () => fetch(`/api/student/job-portal?q=${encodeURIComponent(query)}`).then((r) => r.json()),
  });

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
      <div className="flex gap-2">
        <Input placeholder="Search jobs/company..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No active jobs found.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job: any) => (
            <Card key={job.id} className={selectedJobId === job.id ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <CardTitle className="text-base">{job.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{job.organisationName} · {job.location || "—"}</p>
                <p className="text-sm">Experience: {job.experienceRequired || "—"}</p>
                <p className="text-sm">Salary: {job.salary || job.ctc || "—"}</p>
                <p className="text-sm">Last Date: {formatDate(job.lastDateToApply || job.applicationDeadline)}</p>
                <Button size="sm" onClick={() => setSelectedJobId(job.id)}>Apply Now</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedJobId} onOpenChange={(open) => !open && setSelectedJobId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

