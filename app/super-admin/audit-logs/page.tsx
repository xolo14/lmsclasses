"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type AuditLog = {
  id: string;
  createdAt: string;
  userName: string;
  role: string;
  action: string;
  entity: string;
  metadata: Record<string, unknown>;
};

export default function AuditLogsPage() {
  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs"],
    queryFn: () => fetch("/api/audit-logs").then((r) => r.json()),
    refetchInterval: 10000,
  });

  const columns: ColumnDef<AuditLog>[] = [
    { accessorKey: "createdAt", header: "Timestamp", cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { accessorKey: "userName", header: "User" },
    { accessorKey: "role", header: "Role", cell: ({ row }) => <Badge variant="outline">{row.original.role}</Badge> },
    { accessorKey: "action", header: "Action" },
    { accessorKey: "entity", header: "Entity" },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px] block">
          {JSON.stringify(row.original.metadata || {})}
        </span>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <DataTable columns={columns} data={logs} searchPlaceholder="Search logs..." />
    </div>
  );
}
