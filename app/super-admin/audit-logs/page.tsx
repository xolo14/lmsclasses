"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
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
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["audit-logs"],
    queryFn: async ({ pageParam = "" }) => {
      const res = await fetch(`/api/audit-logs?cursor=${pageParam}&limit=50`);
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(typeof resData?.error === "string" ? resData.error : "Failed to load audit logs");
      }
      return resData;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? undefined,
    staleTime: 2 * 60 * 1000,
  });

  const logs = data ? data.pages.flatMap((page) => page.data) : [];

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
      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Search logs..."
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  );
}
