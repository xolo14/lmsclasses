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
};

export function AddApiKeyModal({ open, onOpenChange }: AddApiKeyModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [allCourses, setAllCourses] = useState(true);

  const { data: courses = [] } = useQuery<{ name: string }[]>({
    queryKey: ["partner-courses"],
    queryFn: () => fetch("/api/super-admin/partner-courses").then((r) => r.json()),
    enabled: open,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<CreateApiKeyInput>({
      resolver: zodResolver(createApiKeySchema),
      defaultValues: {
        name: "",
        permissions: ["submit_lead", "get_lead_status", "confirm_payment"],
        allowedCourses: [],
        allowedPaymentGateway: "any",
        environment: "live",
        autoCreateStudent: true,
        sendWelcomeEmail: true,
        notifyWebhook: false,
        rateLimit: { requests: 200, windowMinutes: 60 },
        ipWhitelist: [],
        expiresAt: null,
        notes: "",
      },
    });

  const selectedPermissions = watch("permissions") ?? [];
  const environment = watch("environment");
  const notifyWebhook = watch("notifyWebhook");

  useEffect(() => {
    if (open) {
      reset();
      setAllCourses(true);
      setError("");
      setGenerated(null);
      setCopied(false);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: CreateApiKeyInput) => {
      const res = await fetch("/api/super-admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          allowedCourses: allCourses ? [] : data.allowedCourses,
          expiresAt: data.expiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate key");
      return json;
    },
    onSuccess: (data) => {
      setGenerated({ key: data.key, id: data.id, name: data.name });
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

  const copyKey = async () => {
    if (!generated?.key) return;
    await navigator.clipboard.writeText(generated.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (generated) {
    return (
      <Dialog open={open} onOpenChange={() => { setGenerated(null); onOpenChange(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Generated — {generated.name}</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              Save this key now. It will never be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <code className="block break-all text-sm font-mono">{generated.key}</code>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={copyKey}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copied" : "Copy Key"}
          </Button>
          <DialogFooter>
            <Button onClick={() => { setGenerated(null); onOpenChange(false); }}>
              I&apos;ve saved my key
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
            Configure permissions and scopes for a digital marketing partner.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Key Name</Label>
              <Input placeholder="Facebook-Agency-Mumbai" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
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

          <div>
            <label className="flex items-center gap-2 text-sm mb-2">
              <input type="checkbox" checked={allCourses} onChange={(e) => setAllCourses(e.target.checked)} />
              All courses allowed
            </label>
            {!allCourses && (
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {courses.map((c) => (
                  <label key={c.name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        const current = watch("allowedCourses") ?? [];
                        setValue(
                          "allowedCourses",
                          e.target.checked
                            ? [...current, c.name]
                            : current.filter((x) => x !== c.name)
                        );
                      }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
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

          <div className="grid gap-3 sm:grid-cols-2">
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
              <Label>Expiry (optional)</Label>
              <Input type="datetime-local" {...register("expiresAt")} />
            </div>
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Generating…" : "Generate Key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
