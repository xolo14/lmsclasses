"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

type CourseLead = {
  id: string;
  name: string;
  phone: string;
  courseSlug: string;
  courseTitle: string;
  createdAt: string;
};

export default function LeadsPage() {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
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
  });

  const leads = data ? data.pages.flatMap((page) => page.data ?? []) : [];

  const columns: ColumnDef<CourseLead>[] = [
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
          rel="noopener noreferrer"
        >
          {row.original.courseTitle}
        </Link>
      ),
    },
    { accessorKey: "createdAt", header: "Submitted", cell: ({ row }) => formatDateTime(row.original.createdAt) },
  ];

  const exportCsv = () => {
    const headers = ["Name", "Phone", "Course", "Course Slug", "Submitted"];
    const rows = leads.map((l) => [l.name, l.phone, l.courseTitle, l.courseSlug, l.createdAt]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "course-leads.csv";
    a.click();
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visitors who entered their details on the landing page to view a course.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={leads}
        searchPlaceholder="Search leads..."
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  );
}
