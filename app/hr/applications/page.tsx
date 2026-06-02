"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export default function HrApplicationsPage() {
  const queryClient = useQueryClient();
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["hr-applications"],
    queryFn: () => fetch("/api/hr/applications").then((r) => r.json()),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "shortlisted" | "rejected" }) => {
      const res = await fetch("/api/hr/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update application");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hr-applications"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Applications</h1>
      <Card>
        <CardHeader><CardTitle>Received Applications</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : applications.length === 0 ? (
            <p className="text-muted-foreground">No applications yet.</p>
          ) : (
            <div className="space-y-3">
              {applications.map((a: any) => (
                <div key={a.id} className="rounded border p-3">
                  <p className="font-medium">{a.applicantName} · {a.jobTitle}</p>
                  <p className="text-sm text-muted-foreground">{a.email} · {a.phone} · {a.collegeName}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.appliedAt)}</p>
                  <div className="mt-2 flex gap-2">
                    <a className="text-sm underline" href={a.resumeUrl} target="_blank" rel="noopener noreferrer">Resume</a>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: a.id, status: "shortlisted" })}>Shortlist</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: a.id, status: "rejected" })}>Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

