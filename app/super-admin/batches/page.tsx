"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { AddBatchModal } from "@/components/modals/AddBatchModal";
import { EditBatchModal } from "@/components/modals/EditBatchModal";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

type Batch = {
  id: string;
  name: string;
  courseTitle: string;
  orgName: string;
  startDate: string;
  endDate: string;
  maxSlots: number;
  enrolledCount: number;
};

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | undefined>();

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ["batches"],
    queryFn: () => fetch("/api/batches").then((r) => r.json()),
  });

  const deleteBatch = useMutation({
    mutationFn: (id: string) => fetch(`/api/batches/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["batches"] }),
  });

  const columns: ColumnDef<Batch>[] = [
    { accessorKey: "name", header: "Batch Name" },
    { accessorKey: "courseTitle", header: "Course" },
    { accessorKey: "orgName", header: "Organisation" },
    { accessorKey: "startDate", header: "Start Date", cell: ({ row }) => formatDate(row.original.startDate) },
    { accessorKey: "endDate", header: "End Date", cell: ({ row }) => formatDate(row.original.endDate) },
    { accessorKey: "maxSlots", header: "Max Slots" },
    { accessorKey: "enrolledCount", header: "Enrolled" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditBatch(row.original)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => deleteBatch.mutate(row.original.id)}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Batches">
        <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Add Batch
        </Button>
      </PageHeader>
      <DataTable columns={columns} data={batches} searchPlaceholder="Search batches..." />
      <AddBatchModal open={modalOpen} onOpenChange={setModalOpen} />
      <EditBatchModal
        open={!!editBatch}
        onOpenChange={(o) => !o && setEditBatch(undefined)}
        batch={editBatch}
      />
    </div>
  );
}
