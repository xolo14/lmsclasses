"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Award, Download, Mail, Ban, Copy, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/charts/KpiCard";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { IssueCertificateModal } from "@/components/certificates/IssueCertificateModal";
import dynamic from "next/dynamic";

const RevenueChart = dynamic(
  () => import("@/components/charts/RevenueChart").then((m) => m.RevenueChart),
  { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded-lg bg-muted" /> }
);

type TemplateRow = {
  id: string;
  name: string;
  courseId: string | null;
  courseType: string | null;
  courseTitle?: string | null;
  orgName: string | null;
  autoIssue: boolean;
  isDefault: boolean;
  isActive: boolean;
  issueCount: number;
  isGlobal: boolean;
  canEdit: boolean;
};

type IssuedRow = {
  id: string;
  certificateNumber: string;
  studentNameSnapshot: string;
  courseNameSnapshot: string;
  orgNameSnapshot: string | null;
  templateName: string | null;
  issuedAt: string;
  emailSentAt: string | null;
  isRevoked: boolean;
};

export function CertificatesAdminPage({ portal }: { portal: "super-admin" | "org-admin" }) {
  const queryClient = useQueryClient();
  const [issueTemplate, setIssueTemplate] = useState<TemplateRow | null>(null);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<TemplateRow[]>({
    queryKey: ["cert-templates"],
    queryFn: () => fetch("/api/certificates/templates").then((r) => r.json()),
  });

  const { data: issuedData, isLoading: loadingIssued } = useQuery<{ certificates: IssuedRow[]; total: number }>({
    queryKey: ["cert-issued"],
    queryFn: () => fetch("/api/certificates/issued").then((r) => r.json()),
  });

  const { data: analytics } = useQuery({
    queryKey: ["cert-analytics"],
    queryFn: () => fetch("/api/certificates/analytics").then((r) => r.json()),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => fetch(`/api/certificates/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cert-templates"] }),
  });

  const duplicateTemplate = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/certificates/templates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: "Copy" }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cert-templates"] }),
  });

  const resendEmail = useMutation({
    mutationFn: (id: string) => fetch(`/api/certificates/${id}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cert-issued"] }),
  });

  const revokeCert = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetch(`/api/certificates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cert-issued"] }),
  });

  const templateColumns: ColumnDef<TemplateRow>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "courseId",
      header: "Course",
      cell: ({ row }) =>
        row.original.courseTitle
          ? `[${row.original.courseType}] ${row.original.courseTitle}`
          : row.original.courseId
            ? `${row.original.courseType}`
            : "General",
    },
    {
      accessorKey: "orgName",
      header: "Org",
      cell: ({ row }) => row.original.orgName ?? (row.original.isGlobal ? "Global" : "—"),
    },
    {
      accessorKey: "autoIssue",
      header: "Auto",
      cell: ({ row }) => (row.original.autoIssue ? "Yes" : "No"),
    },
    {
      accessorKey: "isDefault",
      header: "Default",
      cell: ({ row }) => (row.original.isDefault ? "Yes" : "No"),
    },
    {
      accessorKey: "isActive",
      header: "Active",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "secondary"}>
          {row.original.isActive ? "Active" : "Off"}
        </Badge>
      ),
    },
    { accessorKey: "issueCount", header: "Issued" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.canEdit && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/${portal}/certificates/templates/${row.original.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => duplicateTemplate.mutate(row.original.id)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!row.original.courseId || !row.original.courseType}
            title={
              !row.original.courseId || !row.original.courseType
                ? "Link a course to this template first"
                : "Issue certificates"
            }
            onClick={() => setIssueTemplate(row.original)}
          >
            Issue
          </Button>
          {row.original.canEdit && (
            <Button size="sm" variant="ghost" onClick={() => deleteTemplate.mutate(row.original.id)}>
              Del
            </Button>
          )}
        </div>
      ),
    },
  ];

  const issuedColumns: ColumnDef<IssuedRow>[] = [
    { accessorKey: "certificateNumber", header: "Cert No" },
    { accessorKey: "studentNameSnapshot", header: "Student" },
    { accessorKey: "courseNameSnapshot", header: "Course" },
    { accessorKey: "templateName", header: "Template" },
    {
      accessorKey: "issuedAt",
      header: "Issued",
      cell: ({ row }) => formatDateTime(row.original.issuedAt),
    },
    {
      accessorKey: "emailSentAt",
      header: "Email",
      cell: ({ row }) => (row.original.emailSentAt ? "Sent" : "—"),
    },
    {
      accessorKey: "isRevoked",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isRevoked ? "destructive" : "success"}>
          {row.original.isRevoked ? "Revoked" : "Active"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" asChild>
            <a href={`/api/certificates/${row.original.id}/download`} target="_blank" rel="noreferrer">
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
          {!row.original.isRevoked && (
            <>
              <Button size="sm" variant="ghost" onClick={() => resendEmail.mutate(row.original.id)}>
                <Mail className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const reason = prompt("Revocation reason (min 5 chars):");
                  if (reason && reason.length >= 5) revokeCert.mutate({ id: row.original.id, reason });
                }}
              >
                <Ban className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const chartData = (analytics?.monthly ?? []).map((m: { month: string; count: number }) => ({
    month: m.month,
    revenue: m.count,
  }));

  useEffect(() => {
    void fetch("/api/certificates/auto-issue/process", { method: "POST" }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["cert-issued"] });
      queryClient.invalidateQueries({ queryKey: ["cert-templates"] });
      queryClient.invalidateQueries({ queryKey: ["cert-analytics"] });
    });
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <PageHeader title="Certificates" description="Manage templates and issued certificates">
        <Button asChild>
          <Link href={`/${portal}/certificates/templates/new`}>
            <Plus className="mr-2 h-4 w-4" /> New Template
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Templates" value={templates.length} icon={Award} />
        <KpiCard title="Active Templates" value={templates.filter((t) => t.isActive).length} icon={Award} />
        <KpiCard title="Total Issued" value={analytics?.totals?.total ?? issuedData?.total ?? 0} icon={Award} />
        <KpiCard title="Revoked" value={analytics?.totals?.revoked ?? 0} icon={Ban} />
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="issued">Issued Certificates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <DataTable columns={templateColumns} data={templates} />
        </TabsContent>

        <TabsContent value="issued" className="mt-4">
          <DataTable columns={issuedColumns} data={issuedData?.certificates ?? []} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 font-semibold">Certificates issued per month</h3>
            {chartData.length ? <RevenueChart data={chartData} /> : <p className="text-sm text-muted-foreground">No data yet</p>}
          </div>
        </TabsContent>
      </Tabs>

      {issueTemplate && (
        <IssueCertificateModal
          open={!!issueTemplate}
          onOpenChange={(o) => !o && setIssueTemplate(null)}
          template={issueTemplate}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["cert-issued"] });
            queryClient.invalidateQueries({ queryKey: ["cert-templates"] });
            queryClient.invalidateQueries({ queryKey: ["cert-analytics"] });
          }}
        />
      )}
    </div>
  );
}
