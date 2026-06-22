"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Download, RefreshCw, CheckCircle, Eye } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type PartnerLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city?: string | null;
  course: string;
  courseSlug: string | null;
  source: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  status: string;
  paymentStatus: string;
  studentCreated: boolean;
  apiKeyName: string | null;
  createdAt: string;
};

type WidgetLead = WidgetLeadDetail & {
  courseName: string;
  apiKeyName: string;
  amountAttempted: number | null;
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("partner");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<PartnerLead | null>(null);
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

  const partnerQuery = useQuery({
    queryKey: ["partner-leads", search, statusFilter, paymentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      const res = await fetch(`/api/super-admin/partner-leads?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load partner leads");
      return (json.data ?? []) as PartnerLead[];
    },
    enabled: tab === "partner",
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

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await fetch(`/api/super-admin/partner-leads/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-leads"] });
    },
  });

  const partnerLeads = partnerQuery.data ?? [];
  const widgetLeads = widgetQuery.data?.data ?? [];
  const widgetStats = widgetQuery.data?.stats;
  const today = new Date().toDateString();
  const stats = {
    total: partnerLeads.length,
    today: partnerLeads.filter((l) => new Date(l.createdAt).toDateString() === today).length,
    enrolled: partnerLeads.filter((l) => l.status === "enrolled" || l.studentCreated).length,
    paid: partnerLeads.filter((l) => l.paymentStatus === "completed").length,
  };
  const conversion =
    stats.total > 0 ? Math.round((stats.enrolled / stats.total) * 100) : 0;

  const landingLeads = landingQuery.data
    ? landingQuery.data.pages.flatMap((page) => page.data ?? [])
    : [];

  const partnerColumns: ColumnDef<PartnerLead>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    {
      accessorKey: "course",
      header: "Course",
      cell: ({ row }) =>
        row.original.courseSlug ? (
          <Link
            href={`/courses/${row.original.courseSlug}`}
            className="text-primary hover:underline"
            target="_blank"
          >
            {row.original.course}
          </Link>
        ) : (
          row.original.course
        ),
    },
    { accessorKey: "apiKeyName", header: "API Key", cell: ({ row }) => row.original.apiKeyName ?? "—" },
    { accessorKey: "source", header: "Source", cell: ({ row }) => row.original.utmSource ?? row.original.source ?? "—" },
    {
      accessorKey: "utmCampaign",
      header: "UTM Campaign",
      cell: ({ row }) => row.original.utmCampaign ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      accessorKey: "paymentStatus",
      header: "Payment",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.paymentStatus === "completed"
              ? "success"
              : row.original.paymentStatus === "failed"
                ? "destructive"
                : "secondary"
          }
        >
          {row.original.paymentStatus}
        </Badge>
      ),
    },
    {
      accessorKey: "studentCreated",
      header: "Student",
      cell: ({ row }) => (row.original.studentCreated ? "Yes" : "No"),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setSelectedLead(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
          {row.original.studentCreated && (
            <Button
              size="sm"
              variant="outline"
              title="Resend credentials"
              disabled={actionMutation.isPending}
              onClick={() =>
                actionMutation.mutate({ id: row.original.id, action: "resend-credentials" })
              }
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {row.original.paymentStatus === "pending" && (
            <Button
              size="sm"
              variant="outline"
              title="Manually confirm payment"
              disabled={actionMutation.isPending}
              onClick={() => {
                if (confirm("Confirm payment and create student account?")) {
                  actionMutation.mutate({ id: row.original.id, action: "confirm-payment" });
                }
              }}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

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

  const exportPartnerCsv = () => {
    const leads = partnerLeads;
    const headers = [
      "Name",
      "Email",
      "Phone",
      "City",
      "Course",
      "API Key",
      "UTM Source",
      "UTM Campaign",
      "Status",
      "Payment",
      "Student Created",
      "Date",
    ];
    const rows = leads.map((l) => [
      l.name,
      l.email,
      l.phone,
      l.city ?? "",
      l.course,
      l.apiKeyName ?? "",
      l.utmSource ?? l.source ?? "",
      l.utmCampaign ?? "",
      l.status,
      l.paymentStatus,
      l.studentCreated ? "Yes" : "No",
      l.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "partner-leads.csv";
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
            Partner API leads, widget enrollments, and landing page enquiries.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={tab === "partner" ? exportPartnerCsv : exportLandingCsv}
        >
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="partner">Partner API</TabsTrigger>
          <TabsTrigger value="widget">Widget Leads</TabsTrigger>
          <TabsTrigger value="landing">Landing Page</TabsTrigger>
        </TabsList>

        <TabsContent value="partner" className="space-y-4 mt-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total Leads</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-2xl font-semibold">{stats.today}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Enrolled</p>
              <p className="text-2xl font-semibold">{stats.enrolled}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-2xl font-semibold">{stats.paid}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Conversion</p>
              <p className="text-2xl font-semibold">{conversion}%</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="lead-search">Search</Label>
              <Input
                id="lead-search"
                placeholder="Name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="enrolled">Enrolled</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {partnerQuery.isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <DataTable
              columns={partnerColumns}
              data={partnerLeads}
              searchPlaceholder="Filter table…"
            />
          )}
        </TabsContent>

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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="widget-lead-search">Search</Label>
              <Input
                id="widget-lead-search"
                placeholder="Name, email, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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

      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd>{selectedLead.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{selectedLead.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{selectedLead.phone}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Course</dt>
                <dd>{selectedLead.course}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Source</dt>
                <dd>{selectedLead.source ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">API Key</dt>
                <dd>{selectedLead.apiKeyName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{selectedLead.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment</dt>
                <dd>{selectedLead.paymentStatus}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Student created</dt>
                <dd>{selectedLead.studentCreated ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Submitted</dt>
                <dd>{formatDateTime(selectedLead.createdAt)}</dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <LeadDetailSheet
        lead={selectedWidgetLead}
        open={!!selectedWidgetLead}
        onOpenChange={(open) => !open && setSelectedWidgetLead(null)}
      />
    </div>
  );
}
