"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatCurrency } from "@/lib/utils";

export default function OrganisationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: org, isLoading } = useQuery({
    queryKey: ["organisation", id],
    queryFn: () => fetch(`/api/organisations/${id}`).then((r) => r.json()),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!org?.id) return <div>Organisation not found</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {org.logoUrl ? (
                <img
                  src={org.logoUrl}
                  alt={`${org.name} logo`}
                  className="h-10 w-10 rounded object-contain border border-border bg-muted/30"
                />
              ) : (
                <span className="h-10 w-10 rounded border border-border bg-muted/30 inline-block" />
              )}
              <CardTitle className="truncate">{org.name}</CardTitle>
            </div>
            <Badge variant={org.isActive ? "success" : "destructive"}>
              {org.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Admin</p>
            <p className="font-medium">{org.adminName}</p>
            <p className="text-sm">{org.adminEmail}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Contact</p>
            <p>{org.email || "—"}</p>
            <p>{org.phone || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Joined</p>
            <p>{formatDate(org.createdAt)}</p>
            <p className="text-sm text-primary">{org.studentCount} students</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Students</p><p className="text-2xl font-bold">{org.studentCount}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Payments</p><p className="text-2xl font-bold">{org.payments?.length ?? 0}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Slot Records</p><p className="text-2xl font-bold">{org.slots?.length ?? 0}</p></CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="payments">
          <div className="space-y-2">
            {org.payments?.map((p: { id: string; amount: string; slotsCount: number; status: string; createdAt: string }) => (
              <div key={p.id} className="flex justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-mono">{formatCurrency(p.amount)}</p>
                  <p className="text-sm text-muted-foreground">{p.slotsCount} slots</p>
                </div>
                <Badge variant={p.status === "success" ? "success" : "warning"}>{p.status}</Badge>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="students">
          <div className="space-y-2">
            {org.students?.map((s: { id: string; name: string; email: string; lmsId: string; isActive: boolean }) => (
              <div key={s.id} className="flex justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.email}</p>
                </div>
                <Badge variant="outline">{s.lmsId}</Badge>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
