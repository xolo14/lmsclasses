"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Download, Eye } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { LeadDetailSheet, type WidgetLeadDetail } from "@/components/leads/LeadDetailSheet";

type CourseLead = {
  id: string;
  name: string;
  phone: string;
  courseSlug: string;
  courseTitle: string;
  createdAt: string;
};

type WidgetLead = WidgetLeadDetail & {
  courseName: string;
  apiKeyName: string;
  amountAttempted: number | null;
};

export default function LeadsPage() {
  const [tab, setTab] = useState("widget");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedWidgetLead, setSelectedWidgetLead] = useState<WidgetLead | null>(null);

  const widgetQuery = useQuery({
    queryKey: ["widget-leads", search, paymentFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/super-admin/widget-leads?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load widget leads");
      return json as {
        data: WidgetLead[];
        stats: {
          totalLeads: number;
          conversionRate: number;
          failedPayments: number;
          totalRevenue: number;
        };
      };
    },
    enabled: tab === "widget",
  });

  const landingQuery = useInfiniteQuery({
    queryKey: ["course-leads"],
    queryFn: async ({ pageParam = "" }) => {
      const res = await fetch(`/api/course-leads?cursor=${pageParam}&limit=50`);
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(typeof resData?.error === "string" ? resData.error : "Failed to load leads");
      }
      return resData;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage: { nextCursor?: string | null; data?: CourseLead[] }) =>
      lastPage.nextCursor ?? undefined,
    enabled: tab === "landing",
  });

  const widgetLeads = widgetQuery.data?.data ?? [];
  const widgetStats = widgetQuery.data?.stats;

  const landingLeads = landingQuery.data
    ? landingQuery.data.pages.flatMap((page) => page.data ?? [])
    : [];

  const widgetColumns: ColumnDef<WidgetLead>[] = [
    { accessorKey: "fullName", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "college", header: "College", cell: ({ row }) => row.original.college ?? "—" },
    { accessorKey: "courseName", header: "Course" },
    {
      accessorKey: "paymentStatus",
      header: "Payment",
      cell: ({ row }) => (
        <Badge variant={row.original.paymentStatus === "completed" ? "success" : "secondary"}>
          {row.original.paymentStatus}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Lead Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      accessorKey: "amountAttempted",
      header: "Amount",
      cell: ({ row }) =>
        row.original.amountAttempted != null
          ? `₹${(row.original.amountAttempted / 100).toLocaleString("en-IN")}`
          : "—",
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedWidgetLead(row.original)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const landingColumns: ColumnDef<CourseLead>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "phone", header: "Phone" },
    {
      accessorKey: "courseTitle",
      header: "Course",
      cell: ({ row }) => (
        <Link
          href={`/courses/${row.original.courseSlug}`}
          className="text-primary hover:underline"
          target="_blank"
        >
          {row.original.courseTitle}
        </Link>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Submitted",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
  ];

  const exportWidgetCsv = () => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "College",
      "Year of Study",
      "Degree",
      "Course",
      "API Key",
      "Payment Status",
      "Lead Status",
      "Amount",
      "Created",
    ];
    const rows = widgetLeads.map((l) => [
      l.fullName,
      l.email,
      l.phone,
      l.college ?? "",
      l.yearOfStudy ?? "",
      l.degree ?? "",
      l.courseName,
      l.apiKeyName,
      l.paymentStatus,
      l.status,
      l.amountAttempted != null ? (l.amountAttempted / 100).toString() : "",
      l.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "api-generated-leads.csv";
    a.click();
  };

  const exportLandingCsv = () => {
    const headers = ["Name", "Phone", "Course", "Course Slug", "Submitted"];
    const rows = landingLeads.map((l) => [l.name, l.phone, l.courseTitle, l.courseSlug, l.createdAt]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "landing-leads.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            API generated leads and landing page enquiries.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={tab === "widget" ? exportWidgetCsv : exportLandingCsv}
        >
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(val) => {
          setTab(val);
          setSearch("");
          setStatusFilter("all");
          setPaymentFilter("all");
        }}
      >
        <TabsList className="grid grid-cols-2 max-w-[400px]">
          <TabsTrigger value="widget">API Generated Leads</TabsTrigger>
          <TabsTrigger value="landing">Landing Page</TabsTrigger>
        </TabsList>

        <TabsContent value="widget" className="space-y-4 mt-4">
          {widgetStats && (
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-semibold">{widgetStats.totalLeads}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-semibold">{widgetStats.conversionRate}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Failed Payments</p>
                <p className="text-2xl font-semibold">{widgetStats.failedPayments}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-2xl font-semibold">
                  ₹{widgetStats.totalRevenue.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="widget-lead-search">Search</Label>
              <Input
                id="widget-lead-search"
                placeholder="Name, email, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Payments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="initiated">Initiated</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {widgetQuery.isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : widgetQuery.isError ? (
            <div className="text-destructive">Could not load widget leads.</div>
          ) : (
            <DataTable columns={widgetColumns} data={widgetLeads} searchPlaceholder="Filter…" />
          )}
        </TabsContent>

        <TabsContent value="landing" className="mt-4">
          {landingQuery.isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <DataTable
              columns={landingColumns}
              data={landingLeads}
              searchPlaceholder="Search leads…"
              hasNextPage={landingQuery.hasNextPage}
              fetchNextPage={landingQuery.fetchNextPage}
              isFetchingNextPage={landingQuery.isFetchingNextPage}
            />
          )}
        </TabsContent>
      </Tabs>

      <LeadDetailSheet
        lead={selectedWidgetLead}
        open={!!selectedWidgetLead}
        onOpenChange={(open) => !open && setSelectedWidgetLead(null)}
      />
    </div>
  );
}
