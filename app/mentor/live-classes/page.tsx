"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Copy, ExternalLink } from "lucide-react";

type LiveClass = {
  id: string;
  title: string;
  courseTitle: string;
  batchName: string;
  scheduledAt: string;
  duration: number;
  meetingLink: string;
  status: string;
};

export default function MentorLiveClassesPage() {
  const { data: classes = [], isLoading } = useQuery<LiveClass[]>({
    queryKey: ["live-classes", "mentor", "active"],
    queryFn: async () => {
      const res = await fetch("/api/live-classes/mentor?tab=active");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const columns: ColumnDef<LiveClass>[] = [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "courseTitle", header: "Course" },
    { accessorKey: "batchName", header: "Batch", cell: ({ row }) => row.original.batchName || "—" },
    {
      accessorKey: "scheduledAt",
      header: "Scheduled At",
      cell: ({ row }) => formatDateTime(row.original.scheduledAt),
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => `${row.original.duration || "—"} min`,
    },
    {
      accessorKey: "meetingLink",
      header: "Meeting Link",
      cell: ({ row }) =>
        row.original.meetingLink ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(row.original.meetingLink)}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={row.original.meetingLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" /> Join
              </a>
            </Button>
          </div>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "live" ? "success" : "warning"}>
          {row.original.status}
        </Badge>
      ),
    },
  ];

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Live Classes</h1>
      <DataTable columns={columns} data={classes} searchPlaceholder="Search classes..." />
    </div>
  );
}
