"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Key, Eye, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { AddApiKeyModal } from "@/components/modals/AddApiKeyModal";
import { formatDateTime } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

type ApiKeyRow = {
  id: string;
  name: string;
  maskedKey: string;
  courseId: string | null;
  courseTitle: string | null;
  coursePrice?: number | null;
  permissions: string[];
  environment?: string;
  usageCount?: number;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  totalLeads?: number;
  totalConversions?: number;
  conversionRate?: number;
  totalRevenue?: number;
  formSlug?: string | null;
  formLink?: string | null;
};

export default function SuperAdminApiKeysPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = async (id: string, link: string) => {
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const { data: keys = [], isLoading, isError, error, refetch } = useQuery<ApiKeyRow[]>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/api-keys");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "string" ? body.error : "Failed to load API keys"
        );
      }
      return body;
    },
  });

  const toggleKey = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/super-admin/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/super-admin/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const columns: ColumnDef<ApiKeyRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5 text-muted-foreground" />
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: "maskedKey",
      header: "Masked Key",
      cell: ({ row }) => (
        <code className="text-xs font-mono text-muted-foreground">{row.original.maskedKey}</code>
      ),
    },
    {
      accessorKey: "courseTitle",
      header: "Course",
      cell: ({ row }) => (
        <div className="max-w-[180px]">
          <p className="text-sm font-medium truncate">{row.original.courseTitle ?? "—"}</p>
          {row.original.coursePrice != null && (
            <p className="text-xs text-muted-foreground">₹{row.original.coursePrice.toLocaleString("en-IN")}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "totalLeads",
      header: "Leads",
      cell: ({ row }) => row.original.totalLeads ?? 0,
    },
    {
      accessorKey: "totalConversions",
      header: "Conversions",
      cell: ({ row }) => row.original.totalConversions ?? 0,
    },
    {
      accessorKey: "conversionRate",
      header: "Conv. %",
      cell: ({ row }) => `${row.original.conversionRate ?? 0}%`,
    },
    {
      accessorKey: "totalRevenue",
      header: "Revenue",
      cell: ({ row }) => `₹${(row.original.totalRevenue ?? 0).toLocaleString("en-IN")}`,
    },
    {
      id: "formLink",
      header: "Form link",
      cell: ({ row }) =>
        row.original.formLink ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyLink(row.original.id, row.original.formLink!)}
            >
              {copiedId === row.original.id ? (
                <Check className="h-3.5 w-3.5 mr-1" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1" />
              )}
              {copiedId === row.original.id ? "Copied" : "Copy link"}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={row.original.formLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "environment",
      header: "Env",
      cell: ({ row }) => (
        <Badge variant={row.original.environment === "test" ? "secondary" : "outline"}>
          {row.original.environment ?? "live"}
        </Badge>
      ),
    },
    {
      accessorKey: "usageCount",
      header: "Usage",
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={row.original.isActive ? "outline" : "secondary"}
            onClick={() => toggleKey.mutate(row.original.id)}
          >
            {row.original.isActive ? "Disable" : "Enable"}
          </Button>
          <Badge variant={row.original.isActive ? "success" : "destructive"}>
            {row.original.isActive ? "Active" : "Disabled"}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "lastUsedAt",
      header: "Last Used",
      cell: ({ row }) =>
        row.original.lastUsedAt ? formatDateTime(row.original.lastUsedAt) : "Never",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/super-admin/api-keys/${row.original.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Delete API key "${row.original.name}"? This cannot be undone.`)) {
                deleteKey.mutate(row.original.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="API Keys"
          description="Embed on partner sites or share a hosted form link — one key per course."
        />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
          <p className="text-destructive font-medium">
            Could not load API keys: {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Embed on partner sites or share a hosted form link — one key per course."
      >
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Generate New API Key
        </Button>
      </PageHeader>
      {keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
          <Key className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium">No API keys yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Generate a widget key for each partner. Share the hosted form link (no API key exposed) or give them embed code for their website.
          </p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Generate New API Key
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={keys}
          searchKey="name"
          searchPlaceholder="Search API keys..."
        />
      )}
      <AddApiKeyModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
