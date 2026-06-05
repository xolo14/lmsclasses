"use client";

import { useQuery } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/DataTable";
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
  isActive: boolean;
  createdAt: string;
};

export default function OrgAdminCouponsPage() {
  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["org-coupons"],
    queryFn: () => fetch("/api/org-admin/coupons").then((r) => r.json()),
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
      header: "Min Order Amount",
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
  ];

  if (isLoading) return <div className="text-muted-foreground p-6">Loading coupons...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coupons</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Coupons assigned to your organisation for course slot checkout discounts.
        </p>
      </div>

      <DataTable 
        columns={columns} 
        data={coupons} 
        searchPlaceholder="Search coupons by code..." 
      />
    </div>
  );
}
