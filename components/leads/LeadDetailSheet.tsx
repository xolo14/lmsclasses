"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";

async function patchWidgetLead(
  leadId: string,
  input: { status?: WidgetLeadDetail["status"]; adminNotes?: string | null }
) {
  const res = await fetch(`/api/super-admin/widget-leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `Update failed (${res.status})`);
  }
  return json;
}

async function postWidgetLeadAction(
  leadId: string,
  action: "resend-payment" | "manual-convert"
) {
  const res = await fetch(`/api/super-admin/widget-leads/${leadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `Action failed (${res.status})`);
  }
  return json as { emailSent?: boolean };
}

export type WidgetLeadDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  college: string | null;
  yearOfStudy: string | null;
  degree: string | null;
  courseName: string;
  apiKeyName: string;
  paymentStatus: string;
  status: "new" | "contacted" | "follow_up" | "converted" | "lost";
  failureReason: string | null;
  convertedToStudent: boolean;
  adminNotes: string | null;
  amountAttempted: number | null;
  createdAt: string;
};

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: {
  lead: WidgetLeadDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<WidgetLeadDetail["status"]>("new");
  const [notes, setNotes] = useState(lead?.adminNotes ?? "");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setNotes(lead.adminNotes ?? "");
      setMessage("");
    }
  }, [lead]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["widget-leads"] });
    queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  };

  const saveStatus = useMutation({
    mutationFn: () => patchWidgetLead(lead!.id, { status, adminNotes: notes }),
    onSuccess: () => {
      setMessage("Saved");
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const resend = useMutation({
    mutationFn: () => postWidgetLeadAction(lead!.id, "resend-payment"),
    onSuccess: () => {
      setMessage("Payment link emailed to lead");
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const convert = useMutation({
    mutationFn: () => postWidgetLeadAction(lead!.id, "manual-convert"),
    onSuccess: (result) => {
      setMessage(
        result.emailSent
          ? "Student created and welcome email sent with login credentials."
          : "Student created, but welcome email could not be sent."
      );
      invalidate();
      onOpenChange(false);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[min(90dvh,90vh)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{lead.fullName}</DialogTitle>
          <DialogDescription className="sr-only">
            Widget lead details and enrollment actions
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-0 text-sm border border-border/60 rounded-lg overflow-hidden divide-y divide-border/60 bg-muted/20">
          <Row label="Email" value={lead.email} />
          <Row label="Phone" value={lead.phone} />
          <Row label="College" value={lead.college ?? "—"} />
          <Row label="Year" value={lead.yearOfStudy ?? "—"} />
          <Row label="Degree" value={lead.degree ?? "—"} />
          <Row label="Course" value={lead.courseName} />
          <Row label="API Key" value={lead.apiKeyName} />
          <Row label="Created" value={formatDateTime(lead.createdAt)} />
          <div className="grid grid-cols-3 gap-4 p-3 items-center">
            <dt className="text-muted-foreground font-medium col-span-1">Payment</dt>
            <dd className="text-right col-span-2">
              <Badge variant={lead.paymentStatus === "completed" ? "success" : "secondary"}>
                {lead.paymentStatus}
              </Badge>
            </dd>
          </div>
          {lead.failureReason && <Row label="Failure" value={lead.failureReason} />}
          {lead.amountAttempted != null && (
            <Row label="Amount" value={`₹${(lead.amountAttempted / 100).toLocaleString("en-IN")}`} />
          )}
        </dl>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="font-semibold">Lead status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as WidgetLeadDetail["status"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold">Admin notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this lead..."
            />
          </div>
        </div>

        {message && <p className="text-sm font-medium text-primary mt-2">{message}</p>}

        <DialogFooter className="sm:flex-wrap">
          <Button
            variant="outline"
            onClick={() => saveStatus.mutate()}
            disabled={saveStatus.isPending}
            className="w-full sm:w-auto"
          >
            Save status
          </Button>
          {!lead.convertedToStudent && (
            <>
              <Button
                variant="outline"
                onClick={() => resend.mutate()}
                disabled={resend.isPending}
                className="w-full sm:w-auto"
              >
                Resend payment link
              </Button>
              <Button
                onClick={() => {
                  if (
                    confirm(
                      "Convert this lead to a student and email welcome credentials to the lead?"
                    )
                  ) {
                    convert.mutate();
                  }
                }}
                disabled={convert.isPending}
                className="w-full sm:w-auto"
              >
                Convert manually
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-4 p-3 items-center">
      <dt className="text-muted-foreground font-medium col-span-1">{label}</dt>
      <dd className="min-w-0 text-right col-span-2 break-words font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}
