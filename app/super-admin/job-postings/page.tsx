"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { wrapApiForm } from "@/lib/api-url-transport";
import { formatApiError, formatDate, parseApiJson } from "@/lib/utils";

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

type JobPostingsResponse = {
  items?: JobPostingRow[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  monthImported?: number;
  monthTarget?: number;
  monthLabel?: string;
  error?: unknown;
};

type ImportResponse = {
  done?: boolean;
  inserted?: number;
  monthImported?: number;
  monthTarget?: number;
  monthLabel?: string;
  sources?: string[];
  errors?: string[];
  error?: unknown;
};

export default function SuperAdminJobPostingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState("");

  const { data, isLoading } = useQuery<JobPostingsResponse>({
    queryKey: ["super-admin-job-postings", page, query],
    queryFn: () =>
      fetch(
        `/api/super-admin/job-postings?page=${page}&pageSize=25&q=${encodeURIComponent(query)}`
      ).then((r) => r.json()),
  });

  const jobs = data?.items ?? [];
  const monthImported = data?.monthImported ?? 0;
  const monthTarget = data?.monthTarget ?? 2000;
  const monthLabel = data?.monthLabel ?? "this month";

  const importMonth = useMutation({
    mutationFn: async () => {
      let latest: ImportResponse = {};
      let boards = true;
      for (let i = 0; i < 12; i += 1) {
        setProgress(
          i === 0
            ? `Fetching ${monthLabel} listings…`
            : `Imported ${latest.monthImported ?? monthImported} of ${monthTarget}…`
        );
        const res = await fetch("/api/super-admin/job-postings", {
          method: "POST",
          body: wrapApiForm({
            target: monthTarget,
            maxInsert: monthTarget,
            includeBoards: boards,
          }),
        });
        const json = await parseApiJson<ImportResponse>(res);
        if (!res.ok) {
          throw new Error(formatApiError(json.error, "Failed to import this month's listings"));
        }
        latest = json;
        boards = false;
        if (json.done || (json.inserted ?? 0) === 0) break;
      }
      return latest;
    },
    onSuccess: async (result) => {
      setProgress(
        result.done
          ? `${result.monthLabel || monthLabel}: ${result.monthImported ?? monthTarget} listings ready.`
          : `Imported ${result.monthImported ?? 0} of ${result.monthTarget ?? monthTarget}. Run again to continue.`
      );
      await queryClient.invalidateQueries({ queryKey: ["super-admin-job-postings"] });
    },
    onError: (err) => {
      setProgress(err instanceof Error ? err.message : "Import failed.");
    },
  });

  const columns: ColumnDef<JobPostingRow>[] = [
    { accessorKey: "jobTitle", header: "Job Title" },
    { accessorKey: "companyName", header: "Company Name" },
    { accessorKey: "hrName", header: "Posted By" },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Postings</h1>
          <p className="text-sm text-muted-foreground">
            Each IST month Super Admin loads {monthTarget} latest listings. {monthLabel}: {monthImported} of {monthTarget}
            {data?.total != null ? ` · ${data.total} on the board` : ""}. Last month's platform jobs close when this month is imported. Daily cron can fill the new month automatically.
          </p>
        </div>
        <Button
          onClick={() => importMonth.mutate()}
          disabled={importMonth.isPending || monthImported >= monthTarget}
        >
          {importMonth.isPending
            ? "Importing…"
            : monthImported >= monthTarget
              ? `${monthLabel} loaded`
              : `Import ${monthLabel} listings`}
        </Button>
      </div>

      {progress ? (
        <p className={`text-sm ${importMonth.isError ? "text-destructive" : "text-muted-foreground"}`}>
          {progress}
          {importMonth.data?.sources?.length ? ` Sources: ${importMonth.data.sources.join(", ")}.` : ""}
        </p>
      ) : null}

      <Input
        value={query}
        onChange={(e) => {
          setPage(1);
          setQuery(e.target.value);
        }}
        placeholder="Search title, company, poster..."
        className="w-full sm:max-w-sm"
      />

      {isLoading ? <div className="text-muted-foreground">Loading...</div> : null}
      <DataTable
        columns={columns}
        data={jobs}
        hideSearch
        pageSize={25}
        currentPage={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        totalRows={data?.total ?? 0}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/super-admin/job-postings/${row.id}`)}
      />
    </div>
  );
}
