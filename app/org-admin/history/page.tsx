"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => fetch("/api/history").then((r) => r.json()),
  });

  const exportCsv = (type: "payments" | "activity") => {
    const items = type === "payments" ? data?.payments : data?.studentActivity;
    if (!items?.length) return;
    const headers = Object.keys(items[0]);
    const csv = [headers, ...items.map((i: Record<string, unknown>) => headers.map((h) => i[h]))]
      .map((r) => r.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${type}.csv`;
    a.click();
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">History</h1>
      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="activity">Student Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCsv("payments")}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
          {data?.payments?.map((p: { id: string; courseTitle: string; slotsCount: number; amount: string; status: string; createdAt: string }) => (
            <Card key={p.id}>
              <CardContent className="flex justify-between items-center py-4">
                <div>
                  <p className="font-medium">{p.courseTitle}</p>
                  <p className="text-sm text-muted-foreground">{p.slotsCount} slots · {formatDateTime(p.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-primary">{formatCurrency(p.amount)}</p>
                  <Badge variant={p.status === "success" ? "success" : "warning"}>{p.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="activity" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCsv("activity")}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
          {data?.studentActivity?.map((a: { id: string; action: string; metadata: Record<string, unknown>; createdAt: string }) => (
            <Card key={a.id}>
              <CardContent className="py-4">
                <div className="flex justify-between">
                  <p className="font-medium">{a.action}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-1">{JSON.stringify(a.metadata)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
