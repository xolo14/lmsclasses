"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Mail } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, parseApiJson, ROLE_LABELS } from "@/lib/utils";

export type GoogleConnectionRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  connected: boolean;
  status: "active" | "needs_reconnect" | "revoked" | null;
  googleEmail: string | null;
  isGmail: boolean;
  lastError: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  freebusy: boolean;
  upcomingHostedClasses: number;
  failedMeetCreations: number;
};

export type GoogleConnectionsPayload = {
  stats: {
    configured: boolean;
    hosts: number;
    connected: number;
    needsReconnect: number;
    notConnected: number;
    upcomingMeetCreated: number;
    upcomingMeetPending: number;
    upcomingMeetFailed: number;
    upcomingManual: number;
    missingMeetLink: number;
    createdThisMonth: number;
  };
  rows: GoogleConnectionRow[];
};

export const GOOGLE_CONNECTIONS_KEY = ["google-connections"] as const;

export function useGoogleConnections() {
  return useQuery<GoogleConnectionsPayload>({
    queryKey: GOOGLE_CONNECTIONS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/super-admin/google-connections", { cache: "no-store" });
      const json = await parseApiJson<GoogleConnectionsPayload & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Could not load connections");
      return json;
    },
  });
}

function statusBadge(row: GoogleConnectionRow) {
  if (row.status === "active") return <Badge variant="success">Connected</Badge>;
  if (row.status === "needs_reconnect") return <Badge variant="warning">Reconnect required</Badge>;
  if (row.status === "revoked") return <Badge variant="destructive">Revoked</Badge>;
  return <Badge variant="secondary">Not connected</Badge>;
}

function RemindButton({ row }: { row: GoogleConnectionRow }) {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const remind = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/super-admin/google-connections/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.userId }),
      });
      const json = await parseApiJson<{ ok?: boolean; error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to send");
    },
    onSuccess: () => {
      setNote("Sent");
      qc.invalidateQueries({ queryKey: GOOGLE_CONNECTIONS_KEY });
    },
    onError: (err: Error) => setNote(err.message),
  });
  if (row.connected || !row.isActive) return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" disabled={remind.isPending} onClick={() => remind.mutate()}>
        <Mail className="h-3 w-3 mr-1" /> {row.status === "needs_reconnect" ? "Remind to reconnect" : "Ask to connect"}
      </Button>
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
    </div>
  );
}

export function GoogleConnectionsTable({ rows }: { rows: GoogleConnectionRow[] }) {
  const columns: ColumnDef<GoogleConnectionRow>[] = [
    {
      accessorKey: "name",
      header: "User",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    { accessorKey: "role", header: "Role", cell: ({ row }) => ROLE_LABELS[row.original.role] ?? row.original.role },
    {
      accessorKey: "status",
      header: "Google",
      cell: ({ row }) => (
        <div className="space-y-1">
          {statusBadge(row.original)}
          {row.original.googleEmail && (
            <p className="text-xs text-muted-foreground">
              {row.original.googleEmail}
              {row.original.isGmail && <span className="ml-1 text-amber-700">(Gmail limits)</span>}
            </p>
          )}
          {row.original.lastError && <p className="text-[11px] text-amber-700 max-w-[16rem]">{row.original.lastError}</p>}
        </div>
      ),
    },
    {
      accessorKey: "upcomingHostedClasses",
      header: "Upcoming hosted",
      cell: ({ row }) => row.original.upcomingHostedClasses || "—",
    },
    {
      accessorKey: "failedMeetCreations",
      header: "Failed Meet creations",
      cell: ({ row }) => row.original.failedMeetCreations || "—",
    },
    {
      accessorKey: "lastUsedAt",
      header: "Last used",
      cell: ({ row }) => (row.original.lastUsedAt ? formatDateTime(row.original.lastUsedAt) : "—"),
    },
    {
      accessorKey: "connectedAt",
      header: "Connected",
      cell: ({ row }) => (row.original.connectedAt ? formatDateTime(row.original.connectedAt) : "—"),
    },
    { id: "actions", header: "", cell: ({ row }) => <RemindButton row={row.original} /> },
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search hosts..." />;
}
