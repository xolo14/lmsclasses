"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type Payment = {
  id: string;
  orgName: string;
  courseTitle: string;
  slotsCount: number;
  amount: string;
  razorpayPaymentId: string;
  status: string;
  createdAt: string;
};

export default function PaymentsPage() {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["payments"],
    queryFn: async ({ pageParam = "" }) => {
      const res = await fetch(`/api/payments?cursor=${pageParam}&limit=50`);
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(typeof resData?.error === "string" ? resData.error : "Failed to load payments");
      }
      return resData;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? undefined,
  });

  const payments = data ? data.pages.flatMap((page) => page.data) : [];

  const columns: ColumnDef<Payment>[] = [
    { accessorKey: "orgName", header: "Org Admin" },
    { accessorKey: "courseTitle", header: "Course" },
    { accessorKey: "slotsCount", header: "Slots" },
    { accessorKey: "amount", header: "Amount", cell: ({ row }) => formatCurrency(row.original.amount) },
    { accessorKey: "razorpayPaymentId", header: "Razorpay ID" },
    { accessorKey: "createdAt", header: "Date", cell: ({ row }) => formatDateTime(row.original.createdAt) },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "success" ? "success" : row.original.status === "pending" ? "warning" : "destructive"}>
          {row.original.status}
        </Badge>
      ),
    },
  ];

  const exportCsv = () => {
    const headers = ["Org", "Course", "Slots", "Amount", "Status", "Date"];
    const rows = payments.map((p) => [p.orgName, p.courseTitle, p.slotsCount, p.amount, p.status, p.createdAt]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payments.csv";
    a.click();
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={payments}
        searchPlaceholder="Search payments..."
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  );
}
