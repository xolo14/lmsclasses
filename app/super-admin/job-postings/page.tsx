"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type JobPostingRow = {
  id: string;
  jobTitle: string;
  companyName: string;
  hrName: string;
  employmentType: string;
  applicationsCount: number;
  postedDate: string;
  lastDate: string | null;
  status: string;
};

export default function SuperAdminJobPostingsPage() {
  const router = useRouter();
  const { data: jobs = [], isLoading } = useQuery<JobPostingRow[]>({
    queryKey: ["super-admin-job-postings"],
    queryFn: () => fetch("/api/super-admin/job-postings").then((r) => r.json()),
  });

  const columns: ColumnDef<JobPostingRow>[] = [
    { accessorKey: "jobTitle", header: "Job Title" },
    { accessorKey: "companyName", header: "Company Name" },
    { accessorKey: "hrName", header: "HR Name" },
    {
      accessorKey: "employmentType",
      header: "Employment Type",
      cell: ({ row }) => row.original.employmentType.replaceAll("_", " "),
    },
    { accessorKey: "applicationsCount", header: "Applications Count" },
    {
      accessorKey: "postedDate",
      header: "Posted Date",
      cell: ({ row }) => formatDate(row.original.postedDate),
    },
    {
      accessorKey: "lastDate",
      header: "Last Date",
      cell: ({ row }) => formatDate(row.original.lastDate),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Job Postings</h1>
      <p className="text-sm text-muted-foreground">
        Read-only monitoring view of all HR job postings.
      </p>
      <DataTable
        columns={columns}
        data={jobs}
        searchPlaceholder="Search job postings..."
        onRowClick={(row) => router.push(`/super-admin/job-postings/${row.id}`)}
      />
    </div>
  );
}

