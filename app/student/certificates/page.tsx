"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

type Cert = {
  id: string;
  certificateNumber: string;
  courseNameSnapshot: string;
  issuedAt: string;
};

export default function StudentCertificatesPage() {
  const { data: certificates = [], isLoading } = useQuery<Cert[]>({
    queryKey: ["student-certificates"],
    queryFn: () => fetch("/api/student/certificates").then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Award className="h-7 w-7 text-primary" /> My Certificates
      </h1>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {!isLoading && certificates.length === 0 && (
        <p className="text-muted-foreground">No certificates yet. Complete a course to earn one.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.courseNameSnapshot}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs font-mono text-muted-foreground">{c.certificateNumber}</p>
              <p className="text-sm text-muted-foreground">Issued {formatDateTime(c.issuedAt)}</p>
              <Button size="sm" variant="secondary" asChild>
                <a href={`/api/certificates/${c.id}/download`}>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
