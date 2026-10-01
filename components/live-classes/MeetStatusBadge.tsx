"use client";

import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  not_requested: { label: "No Google Meet", variant: "outline" },
  pending: { label: "Meet pending", variant: "warning" },
  created: { label: "Meet ready", variant: "success" },
  failed: { label: "Meet failed", variant: "destructive" },
  manual: { label: "Manual link", variant: "secondary" },
  cancelled: { label: "Meet cancelled", variant: "outline" },
};

export function MeetStatusBadge({ status, error }: { status: string | null | undefined; error?: string | null }) {
  const entry = LABELS[status ?? "not_requested"] ?? LABELS.not_requested;
  return (
    <Badge variant={entry.variant} title={status === "failed" && error ? error : undefined}>
      {entry.label}
    </Badge>
  );
}
