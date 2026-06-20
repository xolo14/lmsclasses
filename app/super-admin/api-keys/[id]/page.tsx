"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiKeyStatsPanel, type ApiKeyStatsData } from "@/components/api-keys/ApiKeyStatsPanel";
import { formatDateTime } from "@/lib/utils";

function embedTemplate(keyPlaceholder: string, targetId = "lms-enroll-widget") {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "https://lmsclasses.com";
  return `<div id="${targetId}"></div>
<script
  src="${base}/widget/enroll.js"
  data-key="${keyPlaceholder}"
  data-target="${targetId}"
  async
></script>`;
}

type ApiKeyDetail = {
  id: string;
  name: string;
  maskedKey: string;
  keyPrefix: string;
  courseTitle: string | null;
  coursePrice: number | null;
  environment: string;
  isActive: boolean;
  widgetDomainsAllowed: string[];
  redirectOnSuccess: string | null;
  redirectOnFailure: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  notes: string | null;
};

export default function ApiKeyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [rotated, setRotated] = useState<{ key: string; embedSnippet: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: key, isLoading: keyLoading } = useQuery<ApiKeyDetail>({
    queryKey: ["api-key", id],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/api-keys/${id}`);
      if (!res.ok) throw new Error("Failed to load API key");
      return res.json();
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ApiKeyStatsData>({
    queryKey: ["api-key-stats", id],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/api-keys/${id}/stats`);
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const rotate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/super-admin/api-keys/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Rotate failed");
      return json as { key: string; embedSnippet: string };
    },
    onSuccess: (data) => {
      setRotated(data);
      queryClient.invalidateQueries({ queryKey: ["api-key", id] });
    },
  });

  const toggle = useMutation({
    mutationFn: (isActive: boolean) =>
      fetch(`/api/super-admin/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-key", id] }),
  });

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (keyLoading) return <div className="text-muted-foreground p-6">Loading…</div>;
  if (!key) return <div className="text-destructive p-6">API key not found</div>;

  const embedTemplateStr =
    rotated?.embedSnippet ?? embedTemplate(`lms_${key.environment}_${key.keyPrefix}…REPLACE_WITH_FULL_KEY`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/super-admin/api-keys">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
      </div>

      <PageHeader title={key.name} description="Widget key details, funnel analytics, and embed code">
        <div className="flex flex-wrap gap-2">
          <Badge variant={key.isActive ? "success" : "destructive"}>
            {key.isActive ? "Active" : "Disabled"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggle.mutate(!key.isActive)}
            disabled={toggle.isPending}
          >
            {key.isActive ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Rotate this key? The old key will stop working immediately.")) {
                rotate.mutate();
              }
            }}
            disabled={rotate.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Rotate
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
        <Info label="Course" value={key.courseTitle ?? "—"} />
        <Info label="Price" value={key.coursePrice != null ? `₹${key.coursePrice.toLocaleString("en-IN")}` : "—"} />
        <Info label="Environment" value={key.environment} />
        <Info label="Last used" value={key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "Never"} />
      </div>

      {rotated && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-900">New key generated — save now</p>
          <code className="block text-xs break-all">{rotated.key}</code>
          <Button size="sm" variant="outline" onClick={() => copy(rotated.key, "key")}>
            {copied === "key" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Copy key
          </Button>
          <pre className="text-xs whitespace-pre-wrap break-all bg-background p-3 rounded border">{rotated.embedSnippet}</pre>
          <Button size="sm" variant="outline" onClick={() => copy(rotated.embedSnippet, "embed")}>
            {copied === "embed" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Copy embed code
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Embed code template</h3>
          <Button size="sm" variant="outline" onClick={() => copy(embedTemplateStr, "template")}>
            {copied === "template" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Replace the placeholder key with your full key after rotation, or use the snippet from key generation.
        </p>
        <pre className="text-xs whitespace-pre-wrap break-all bg-muted/40 p-3 rounded">{embedTemplateStr}</pre>
      </div>

      {statsLoading ? (
        <div className="text-muted-foreground">Loading stats…</div>
      ) : stats ? (
        <ApiKeyStatsPanel stats={stats} />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium mt-1">{value}</p>
    </div>
  );
}
