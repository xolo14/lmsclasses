"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Download, FileText } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type PaymentType = "live" | "record";

type Payment = {
  id: string;
  orgName: string | null;
  courseTitle: string;
  slotsCount: number;
  amount: string;
  razorpayPaymentId: string;
  invoiceUrl: string | null;
  status: string;
  createdAt: string;
};

function PaymentsTab({ type }: { type: PaymentType }) {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["payments", type],
    queryFn: async ({ pageParam = "" }) => {
      const res = await fetch(`/api/payments?cursor=${pageParam}&limit=50&type=${type}`);
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(typeof resData?.error === "string" ? resData.error : "Failed to load payments");
      }
      return resData;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage: { nextCursor?: string | null; data?: Payment[] }) =>
      lastPage.nextCursor ?? undefined,
  });

  const payments = data ? data.pages.flatMap((page) => page.data ?? []) : [];

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "orgName",
      header: type === "record" ? "Source" : "Org Admin",
      cell: ({ row }) => row.original.orgName ?? (type === "record" ? "Public enrollment" : "—"),
    },
    { accessorKey: "courseTitle", header: "Course" },
    { accessorKey: "slotsCount", header: type === "record" ? "Seats" : "Slots" },
    { accessorKey: "amount", header: "Amount", cell: ({ row }) => formatCurrency(row.original.amount) },
    { accessorKey: "razorpayPaymentId", header: "Razorpay ID" },
    {
      accessorKey: "invoiceUrl",
      header: "Invoice",
      cell: ({ row }) =>
        row.original.invoiceUrl ? (
          <a
            href={row.original.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            PDF
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
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
    const sourceHeader = type === "record" ? "Source" : "Org";
    const slotsHeader = type === "record" ? "Seats" : "Slots";
    const headers = [sourceHeader, "Course", slotsHeader, "Amount", "Status", "Invoice", "Date"];
    const rows = payments.map((p) => [
      p.orgName ?? (type === "record" ? "Public enrollment" : ""),
      p.courseTitle,
      p.slotsCount,
      p.amount,
      p.status,
      p.invoiceUrl ?? "",
      p.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${type}.csv`;
    a.click();
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={payments}
        searchPlaceholder={`Search ${type === "live" ? "live class" : "record class"} payments...`}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payments</h1>
      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live Classes</TabsTrigger>
          <TabsTrigger value="record">Record Classes</TabsTrigger>
        </TabsList>
        <TabsContent value="live">
          <PaymentsTab type="live" />
        </TabsContent>
        <TabsContent value="record">
          <PaymentsTab type="record" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
