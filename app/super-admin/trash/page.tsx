"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { RotateCcw, Trash2 } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type TrashItem = {
  id: string;
  entityType: string;
  name: string;
  deletedAt: string;
  expiresAt: string;
};

export default function TrashPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ items: TrashItem[]; retentionDays: number }>({
    queryKey: ["trash"],
    queryFn: () => fetch("/api/trash").then((r) => r.json()),
  });

  const restore = useMutation({
    mutationFn: (item: TrashItem) =>
      fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: item.entityType, id: item.id }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trash"] }),
  });

  const clearTrash = useMutation({
    mutationFn: () =>
      fetch("/api/trash", {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trash"] }),
  });

  const handleClearTrash = () => {
    if (
      confirm(
        "Are you sure you want to permanently delete all items in the trash? This action cannot be undone."
      )
    ) {
      clearTrash.mutate();
    }
  };

  const columns: ColumnDef<TrashItem>[] = [
    {
      accessorKey: "entityType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.entityType.replace("_", " ")}</Badge>
      ),
    },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "deletedAt",
      header: "Deleted At",
      cell: ({ row }) => formatDateTime(row.original.deletedAt),
    },
    {
      accessorKey: "expiresAt",
      header: "Permanent delete after",
      cell: ({ row }) => formatDateTime(row.original.expiresAt),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => restore.mutate(row.original)}
          disabled={restore.isPending}
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Restore
        </Button>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Trash</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deleted items are kept for {data?.retentionDays ?? 30} days, then permanently removed.
          </p>
        </div>
        {data?.items && data.items.length > 0 && (
          <Button
            variant="destructive"
            onClick={handleClearTrash}
            disabled={clearTrash.isPending}
            className="sm:w-auto w-full shadow-lg shadow-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Clear Trash
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        searchPlaceholder="Search trash..."
        searchKey="name"
      />
    </div>
  );
}
