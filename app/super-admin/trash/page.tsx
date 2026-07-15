"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { RotateCcw, Trash2 } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type TrashItem = {
  id: string;
  entityType: string;
  name: string;
  deletedAt: string;
  expiresAt: string;
};

export default function TrashPage() {
  const queryClient = useQueryClient();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: TrashItem[]; retentionDays: number }>({
    queryKey: ["trash"],
    queryFn: async () => {
      const res = await fetch("/api/trash");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to load trash (${res.status})`);
      }
      return res.json();
    },
  });

  const restore = useMutation({
    mutationFn: async (item: TrashItem) => {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: item.entityType, id: item.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Restore failed (${res.status})`);
      }
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Restore failed"),
  });

  const clearTrash = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/trash", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Clear trash failed (${res.status})`);
      }
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      setIsConfirmOpen(false);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Clear trash failed"),
  });

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

  const hasItems = !!data?.items && data.items.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Trash</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deleted items are kept for {data?.retentionDays ?? 30} days, then permanently removed.
          </p>
        </div>
        <div>
          <Button
            variant="destructive"
            onClick={() => setIsConfirmOpen(true)}
            disabled={!hasItems || clearTrash.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Trash
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        searchPlaceholder="Search trash..."
        searchKey="name"
      />

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty Trash?</DialogTitle>
            <DialogDescription>
              This action will permanently delete all soft-deleted items from the website.
              This cannot be undone. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={clearTrash.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearTrash.mutate()}
              disabled={clearTrash.isPending}
            >
              {clearTrash.isPending ? "Emptying..." : "Empty Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
