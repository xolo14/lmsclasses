"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

type JobRow = {
  id: string;
  title: string;
  organisationName: string;
  location: string | null;
  employmentType: string;
  experienceRequired: string | null;
  stipend?: string | null;
  salary: string | null;
  ctc: string | null;
  description?: string | null;
  applicationDeadline: string;
};

type JobsResponse = {
  items?: JobRow[];
  page?: number;
  total?: number;
  totalPages?: number;
  error?: string;
};

export function JobListingsBoard({
  title = "Job Listings",
  description = "Latest Super Admin listings. Same board students see.",
}: {
  title?: string;
  description?: string;
}) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<JobRow | null>(null);

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["job-board", page, query],
    queryFn: () =>
      fetch(`/api/jobs/board?q=${encodeURIComponent(query)}&page=${page}&pageSize=25`).then((r) => r.json()),
  });

  const jobs = data?.items ?? [];

  const columns: ColumnDef<JobRow>[] = [
    { accessorKey: "title", header: "Job Title" },
    { accessorKey: "organisationName", header: "Company Name" },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => row.original.location || "—",
    },
    {
      accessorKey: "employmentType",
      header: "Employment Type",
      cell: ({ row }) => row.original.employmentType.replaceAll("_", " "),
    },
    {
      accessorKey: "applicationDeadline",
      header: "Last Date",
      cell: ({ row }) => formatDate(row.original.applicationDeadline),
    },
    {
      id: "pay",
      header: "Pay",
      cell: ({ row }) => {
        const job = row.original;
        if (job.employmentType === "internship") return job.stipend || "—";
        if (job.employmentType === "part_time") return job.salary || "—";
        return job.ctc || "—";
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Input
        value={query}
        onChange={(e) => {
          setPage(1);
          setQuery(e.target.value);
        }}
        placeholder="Search title or company..."
        className="w-full sm:max-w-sm"
      />

      {data?.error ? (
        <p className="text-sm text-destructive">{data.error}</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading listings...</p>
      ) : null}

      <DataTable
        columns={columns}
        data={jobs}
        hideSearch
        pageSize={25}
        currentPage={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        totalRows={data?.total ?? 0}
        onPageChange={setPage}
        onRowClick={setSelected}
      />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[min(90dvh,90vh)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected?.organisationName} · {selected?.location || "—"}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <p>
                <Badge variant="outline">{selected.employmentType.replaceAll("_", " ")}</Badge>
              </p>
              <p>Experience: {selected.experienceRequired || "—"}</p>
              <p>
                Last date: {formatDate(selected.applicationDeadline)}
              </p>
              <p className="whitespace-pre-wrap text-muted-foreground">{selected.description || "—"}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
