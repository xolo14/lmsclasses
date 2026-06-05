"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { AddCouponModal } from "@/components/modals/AddCouponModal";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: string;
  minOrderAmount: string;
  maxUses: number | null;
  usesCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  organisationId: string | null;
  orgName: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function SuperAdminCouponsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: () => fetch("/api/super-admin/coupons").then((r) => r.json()),
  });

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => fetch(`/api/super-admin/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const columns: ColumnDef<Coupon>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-primary text-sm flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          {row.original.code}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => row.original.description || "—",
    },
    {
      accessorKey: "discountValue",
      header: "Discount",
      cell: ({ row }) => {
        const value = parseFloat(row.original.discountValue);
        return row.original.discountType === "percent"
          ? `${value}% Off`
          : `${formatCurrency(value)} Off`;
      },
    },
    {
      accessorKey: "minOrderAmount",
      header: "Min Order",
      cell: ({ row }) => formatCurrency(parseFloat(row.original.minOrderAmount)),
    },
    {
      accessorKey: "usesCount",
      header: "Uses",
      cell: ({ row }) => (
        <span>
          {row.original.usesCount} / {row.original.maxUses ?? "∞"}
        </span>
      ),
    },
    {
      accessorKey: "orgName",
      header: "Assigned To",
      cell: ({ row }) =>
        row.original.orgName ? (
          <span className="font-medium text-foreground">{row.original.orgName}</span>
        ) : (
          <Badge variant="outline" className="text-muted-foreground font-normal">Public</Badge>
        ),
    },
    {
      accessorKey: "startsAt",
      header: "Starts",
      cell: ({ row }) => (row.original.startsAt ? formatDateTime(row.original.startsAt) : "Immediate"),
    },
    {
      accessorKey: "expiresAt",
      header: "Expires",
      cell: ({ row }) => (row.original.expiresAt ? formatDateTime(row.original.expiresAt) : "Never"),
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
      cell: ({ row }) => (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (confirm(`Are you sure you want to delete coupon ${row.original.code}?`)) {
              deleteCoupon.mutate(row.original.id);
            }
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground p-6">Loading coupons...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Coupons">
        <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Add Coupon
        </Button>
      </PageHeader>
      
      <DataTable 
        columns={columns} 
        data={coupons} 
        searchPlaceholder="Search coupons by code..." 
      />

      <AddCouponModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
      />
    </div>
  );
}
