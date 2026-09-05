"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { AddBatchModal } from "@/components/modals/AddBatchModal";
import { EditBatchModal } from "@/components/modals/EditBatchModal";
import { BulkImportModal } from "@/components/modals/BulkImportModal";
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
  const [importModalOpen, setImportModalOpen] = useState(false);
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
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setImportModalOpen(true)} className="w-full sm:w-auto">
            <Upload className="h-4 w-4 mr-2" /> Import
          </Button>
          <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Batch
          </Button>
        </div>
      </PageHeader>
      <DataTable columns={columns} data={batches} searchPlaceholder="Search batches..." />
      <AddBatchModal open={modalOpen} onOpenChange={setModalOpen} />
      <EditBatchModal
        open={!!editBatch}
        onOpenChange={(o) => !o && setEditBatch(undefined)}
        batch={editBatch}
      />
      <BulkImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Bulk Import Batches"
        description="Upload an Excel or CSV file containing batch details. The table below shows a preview of parsed records."
        templateHeaders={["Batch Name", "Course Title", "Organisation Name", "Start Date", "End Date", "Max Slots"]}
        templateSampleRows={[
          ["Batch 2026-A", "Full Stack Web Development", "TechCorp Solutions", "2026-10-01", "2027-01-31", "30"],
          ["Batch 2026-B", "Python for Beginners", "", "2026-11-01", "2027-02-28", "25"]
        ]}
        headerMapping={{
          name: "Batch Name",
          courseTitle: "Course Title",
          orgName: "Organisation Name",
          startDate: "Start Date",
          endDate: "End Date",
          maxSlots: "Max Slots"
        }}
        onImport={async (data) => {
          const res = await fetch("/api/batches/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json();
          if (!res.ok) {
            return { successCount: 0, error: json.error || "Failed to bulk import batches." };
          }
          return { successCount: json.successCount };
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["batches"] });
        }}
      />
    </div>
  );
}
