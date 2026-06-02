"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AddOrganisationAdminModal,
  type OrganisationRow,
} from "@/components/modals/AddOrganisationAdminModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatDate } from "@/lib/utils";

type Org = OrganisationRow & {
  studentCount: number;
  coursesBought: number;
  createdAt: string;
  logoUrl?: string | null;
};

export default function OrganisationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<OrganisationRow | undefined>();

  const { data: orgs = [], isLoading } = useQuery<Org[]>({
    queryKey: ["organisations"],
    queryFn: async () => {
      const res = await fetch("/api/organisations");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const deleteOrg = useMutation({
    mutationFn: (id: string) => fetch(`/api/organisations/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organisations"] }),
  });

  const columns: ColumnDef<Org>[] = [
    {
      accessorKey: "name",
      header: "Org Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.logoUrl ? (
            <img
              src={row.original.logoUrl}
              alt={`${row.original.name} logo`}
              className="h-6 w-6 rounded object-contain border border-border bg-muted/30"
            />
          ) : (
            <span className="inline-block h-6 w-6 rounded border border-border bg-muted/30" />
          )}
          <span>{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: "adminName", header: "Admin Name" },
    {
      accessorKey: "adminEmail",
      header: "Email",
      cell: ({ row }) => row.original.adminEmail ?? row.original.email ?? "—",
    },
    { accessorKey: "studentCount", header: "Students" },
    { accessorKey: "coursesBought", header: "Courses Bought" },
    {
      accessorKey: "createdAt",
      header: "Joined Date",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "destructive"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/super-admin/organisations/${row.original.id}`)}
          >
            <Eye className="h-3 w-3 mr-1" /> View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditOrg(row.original);
              setModalOpen(true);
            }}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Move "${row.original.name}" to trash?`)) {
                deleteOrg.mutate(row.original.id);
              }
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Organisations">
        <Button
          onClick={() => {
            setEditOrg(undefined);
            setModalOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Admin
        </Button>
      </PageHeader>
      <DataTable
        columns={columns}
        data={orgs}
        searchPlaceholder="Search organisations..."
        searchKey="name"
      />
      <AddOrganisationAdminModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditOrg(undefined);
        }}
        organisation={editOrg}
      />
    </div>
  );
}
