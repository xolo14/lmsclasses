"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import {
  createApiKeySchema,
  type CreateApiKeyInput,
} from "@/lib/validations/api-key";
import { PERMISSION_GROUPS } from "@/lib/api-key-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GeneratedKey = {
  key: string;
  id: string;
  name: string;
  courseId: string;
  courseTitle: string;
};

export function AddApiKeyModal({ open, onOpenChange }: AddApiKeyModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [copiedField, setCopiedField] = useState<"key" | "courseId" | null>(null);

  const { data: courses = [] } = useQuery<{ id: string; name: string; price?: number }[]>({
    queryKey: ["partner-courses"],
    queryFn: () => fetch("/api/super-admin/partner-courses").then((r) => r.json()),
    enabled: open,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<CreateApiKeyInput>({
      resolver: zodResolver(createApiKeySchema),
      defaultValues: {
        name: "",
        courseId: "",
        permissions: [
          "submit_lead",
          "get_lead_status",
          "create_payment_order",
          "confirm_payment",
          "get_course_list",
        ],
        allowedPaymentGateway: "any",
        environment: "live",
        autoCreateStudent: true,
        sendWelcomeEmail: true,
        notifyWebhook: false,
        rateLimit: { requests: 200, windowMinutes: 60 },
        ipWhitelist: [],
        notes: "",
      },
    });

  const selectedPermissions = watch("permissions") ?? [];
  const environment = watch("environment");
  const notifyWebhook = watch("notifyWebhook");
  const selectedCourseId = watch("courseId");

  useEffect(() => {
    if (open) {
      reset();
      setError("");
      setGenerated(null);
      setCopiedField(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: CreateApiKeyInput) => {
      const res = await fetch("/api/super-admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate key");
      return json;
    },
    onSuccess: (data) => {
      setGenerated({
        key: data.key,
        id: data.id,
        name: data.name,
        courseId: data.courseId,
        courseTitle: data.courseTitle ?? "Course",
      });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const togglePermission = (perm: string) => {
    const next = selectedPermissions.includes(perm as CreateApiKeyInput["permissions"][number])
      ? selectedPermissions.filter((p) => p !== perm)
      : [...selectedPermissions, perm as CreateApiKeyInput["permissions"][number]];
    setValue("permissions", next, { shouldValidate: true });
  };

  const copyValue = async (value: string, field: "key" | "courseId") => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (generated) {
    return (
      <Dialog open={open} onOpenChange={() => { setGenerated(null); onOpenChange(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Generated — {generated.name}</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              Save the API key and Course ID now. They will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-swiss-black/10 bg-swiss-cream/50 p-3 text-sm">
            <p className="font-medium">{generated.courseTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Give your partner both values below for their LMS integration.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Key</Label>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mt-1">
                <code className="block break-all text-sm font-mono">{generated.key}</code>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => copyValue(generated.key, "key")}
              >
                {copiedField === "key" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedField === "key" ? "Copied" : "Copy API Key"}
              </Button>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Course ID</Label>
              <div className="rounded-lg border border-swiss-black/15 bg-background p-3 mt-1">
                <code className="block break-all text-sm font-mono">{generated.courseId}</code>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => copyValue(generated.courseId, "courseId")}
              >
                {copiedField === "courseId" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedField === "courseId" ? "Copied" : "Copy Course ID"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => { setGenerated(null); onOpenChange(false); }}>
              I&apos;ve saved both values
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Partner API Key</DialogTitle>
          <DialogDescription>
            Each key is tied to one course. Partners need the API key + Course ID for their integration.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Key Name</Label>
              <Input placeholder="Facebook-Agency-Mumbai" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <Label>Course *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm mt-1"
                value={selectedCourseId}
                onChange={(e) => setValue("courseId", e.target.value, { shouldValidate: true })}
              >
                <option value="">Select a course…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.price !== undefined ? ` — ₹${c.price.toLocaleString("en-IN")}` : ""}
                  </option>
                ))}
              </select>
              {selectedCourseId && (
                <p className="text-[11px] font-mono text-muted-foreground mt-1 break-all">
                  Course ID: {selectedCourseId}
                </p>
              )}
              {errors.courseId && (
                <p className="text-sm text-destructive mt-1">{errors.courseId.message}</p>
              )}
            </div>

            <div>
              <Label>Environment</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("environment")}>
                <option value="live">Live (lms_live_…)</option>
                <option value="test">Test (lms_test_… — no real students/emails)</option>
              </select>
            </div>
            <div>
              <Label>Payment Gateway</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("allowedPaymentGateway")}>
                <option value="any">Any</option>
                <option value="razorpay">Razorpay only</option>
                <option value="manual">Manual only</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Permissions</Label>
            {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
              <div key={group} className="mb-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{group}</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {perms.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                      />
                      <span className="font-mono text-xs">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("autoCreateStudent")} />
              Auto-create student
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("sendWelcomeEmail")} />
              Send welcome email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("notifyWebhook")} />
              Webhook notifications
            </label>
          </div>

          {notifyWebhook && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Webhook URL</Label>
                <Input placeholder="https://partner.com/webhook" {...register("webhookUrl")} />
              </div>
              <div>
                <Label>Webhook Secret</Label>
                <Input placeholder="Optional signing secret" {...register("webhookSecret")} />
              </div>
            </div>
          )}

          <div>
            <Label>Rate limit (requests / hour)</Label>
            <Input
              type="number"
              defaultValue={200}
              onChange={(e) =>
                setValue("rateLimit", {
                  requests: parseInt(e.target.value, 10) || 200,
                  windowMinutes: 60,
                })
              }
            />
          </div>

          <div>
            <Label>IP Whitelist (comma-separated, empty = all)</Label>
            <Input
              placeholder="103.21.45.67, 49.36.12.8"
              onChange={(e) =>
                setValue(
                  "ipWhitelist",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={2} placeholder="Facebook Ads agency for South India" {...register("notes")} />
          </div>

          {environment === "test" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Test keys validate all requests but do not create real students or send emails.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !selectedCourseId}>
              {mutation.isPending ? "Generating…" : "Generate Key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
