"use client";

import { FunnelChart } from "@/components/charts/FunnelChart";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export type ApiKeyStatsData = {
  totalWidgetLoads: number;
  totalFormSubmits: number;
  totalPaymentAttempts: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  dropOffRate: number;
  funnel: { step: string; label: string; count: number }[];
  recentLeads: Array<{
    id: string;
    fullName: string;
    email: string;
    paymentStatus: string;
    status: string;
    createdAt: string;
  }>;
};

export function ApiKeyStatsPanel({ stats }: { stats: ApiKeyStatsData }) {
  const funnelData = stats.funnel.map((f) => ({ label: f.label, count: f.count }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Widget Loads" value={stats.totalWidgetLoads} />
        <StatCard label="Form Submits" value={stats.totalFormSubmits} />
        <StatCard label="Conversions" value={stats.totalConversions} />
        <StatCard label="Revenue" value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`} />
        <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} />
        <StatCard label="Payment Drop-off" value={`${stats.dropOffRate}%`} />
        <StatCard label="Payment Attempts" value={stats.totalPaymentAttempts} />
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold mb-4">Enrollment Funnel</h3>
        <FunnelChart data={funnelData} />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent Leads</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No leads yet
                  </td>
                </tr>
              ) : (
                stats.recentLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{lead.fullName}</td>
                    <td className="p-3">{lead.email}</td>
                    <td className="p-3">
                      <Badge variant={lead.paymentStatus === "completed" ? "success" : "secondary"}>
                        {lead.paymentStatus}
                      </Badge>
                    </td>
                    <td className="p-3">{lead.status}</td>
                    <td className="p-3 text-muted-foreground">{formatDateTime(lead.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
