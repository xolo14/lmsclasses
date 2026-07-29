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
  embedSnippet: string;
  formLink?: string;
  id: string;
  name: string;
  courseId: string;
  courseTitle: string;
  coursePrice?: number;
};

export function AddApiKeyModal({ open, onOpenChange }: AddApiKeyModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [copiedField, setCopiedField] = useState<"key" | "embed" | "formLink" | "courseId" | null>(null);
  const [domainsInput, setDomainsInput] = useState("");
  const [redirectMode, setRedirectMode] = useState<"default" | "custom">("default");
  const [failureMode, setFailureMode] = useState<"inline" | "custom">("inline");

  const {
    data: courses = [],
    isLoading: coursesLoading,
    isError: coursesError,
  } = useQuery<{ id: string; name: string; price?: number }[]>({
    queryKey: ["partner-courses"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/partner-courses");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Failed to load courses");
      }
      if (!Array.isArray(json)) throw new Error("Invalid courses response");
      return json;
    },
    enabled: open,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<CreateApiKeyInput>({
      resolver: zodResolver(createApiKeySchema),
      defaultValues: {
        keyType: "widget",
        name: "",
        courseId: "",
        widgetDomainsAllowed: [],
        redirectOnSuccess: "/login",
        redirectOnFailure: null,
        environment: "live",
        autoCreateStudent: true,
        sendWelcomeEmail: true,
        notes: "",
      },
    });

  const environment = watch("environment");
  const selectedCourseId = watch("courseId");
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  useEffect(() => {
    if (open) {
      reset();
      setError("");
      setGenerated(null);
      setCopiedField(null);
      setDomainsInput("");
      setRedirectMode("default");
      setFailureMode("inline");
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open || courses.length === 0) return;
    if (!selectedCourseId) {
      setValue("courseId", courses[0].id, { shouldValidate: true });
    }
  }, [open, courses, selectedCourseId, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: CreateApiKeyInput) => {
      const domains = domainsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/super-admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, widgetDomainsAllowed: domains }),
      });
      const json = await res.json();
      if (!res.ok) {
        const detail =
          json.details && typeof json.details === "object"
            ? Object.entries(json.details)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                .join("; ")
            : "";
        throw new Error([json.error, detail].filter(Boolean).join(" — "));
      }
      return json;
    },
    onSuccess: (data) => {
      setGenerated({
        key: data.key,
        embedSnippet: data.embedSnippet,
        formLink: data.formLink,
        id: data.id,
        name: data.name,
        courseId: data.courseId,
        courseTitle: data.courseTitle ?? "Course",
        coursePrice: data.coursePrice,
      });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const copyValue = async (value: string, field: typeof copiedField) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (generated) {
    return (
      <Dialog open={open} onOpenChange={() => { setGenerated(null); onOpenChange(false); }}>
        <DialogContent className="max-w-2xl max-h-[min(90dvh,90vh)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Key Generated — {generated.name}</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              Save the API key now — it won&apos;t be shown again. The form link and embed code are always available in API Keys.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-swiss-black/10 bg-swiss-cream/50 p-3 text-sm">
            <p className="font-medium">
              {generated.courseTitle}
              {generated.coursePrice !== undefined ? ` — ₹${generated.coursePrice.toLocaleString("en-IN")}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Share the hosted form link (no API key needed) or embed the script on a partner website.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Key</Label>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mt-1">
                <code className="block break-all text-sm font-mono">{generated.key}</code>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => copyValue(generated.key, "key")}>
                {copiedField === "key" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedField === "key" ? "Copied" : "Copy API Key"}
              </Button>
            </div>

            {generated.formLink && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Hosted form link</Label>
                <div className="rounded-lg border border-swiss-black/15 bg-background p-3 mt-1">
                  <code className="block break-all text-sm font-mono">{generated.formLink}</code>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => copyValue(generated.formLink!, "formLink")}
                >
                  {copiedField === "formLink" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copiedField === "formLink" ? "Copied" : "Copy form link"}
                </Button>
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Embed Code</Label>
              <div className="rounded-lg border border-swiss-black/15 bg-background p-3 mt-1">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">{generated.embedSnippet}</pre>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => copyValue(generated.embedSnippet, "embed")}>
                {copiedField === "embed" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedField === "embed" ? "Copied" : "Copy Embed Code"}
              </Button>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Course ID</Label>
              <code className="block break-all text-sm font-mono mt-1">{generated.courseId}</code>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => { setGenerated(null); onOpenChange(false); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[min(90dvh,90vh)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Partner Widget Key</DialogTitle>
          <DialogDescription>
            Each key is tied to one course. You get a shareable form link and optional embed code for partner sites.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => {
            if (redirectMode === "default") setValue("redirectOnSuccess", "/login");
            if (failureMode === "inline") setValue("redirectOnFailure", null);
            mutation.mutate(d);
          })}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Key Name</Label>
              <Input placeholder="Instagram-Agency-Pune" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <Label>Course *</Label>
              {coursesLoading ? (
                <p className="text-sm text-muted-foreground mt-1">Loading courses…</p>
              ) : coursesError ? (
                <p className="text-sm text-destructive mt-1">Could not load courses.</p>
              ) : courses.length === 0 ? (
                <p className="text-sm text-destructive mt-1">No active record courses found.</p>
              ) : (
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm mt-1" {...register("courseId")}>
                  <option value="">Select a course…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.price !== undefined ? ` — ₹${c.price.toLocaleString("en-IN")}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedCourse && (
                <p className="text-xs text-muted-foreground mt-1">
                  Widget will show: {selectedCourse.name} — ₹{selectedCourse.price?.toLocaleString("en-IN") ?? "—"}
                </p>
              )}
            </div>

            <div>
              <Label>Environment</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("environment")}>
                <option value="live">Live (lms_live_…)</option>
                <option value="test">Test (lms_test_…)</option>
              </select>
            </div>

            <div>
              <Label>Expiry Date (optional)</Label>
              <Input type="date" {...register("expiresAt")} />
            </div>

            <div className="sm:col-span-2">
              <Label>Allowed Domains (optional, comma-separated)</Label>
              <Input
                placeholder="partner-agency.com, landingpage.io"
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty to allow embedding on any domain.</p>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label>After successful payment</Label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={redirectMode === "default"} onChange={() => setRedirectMode("default")} />
                Default login page (/login)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={redirectMode === "custom"} onChange={() => setRedirectMode("custom")} />
                Custom URL
              </label>
              {redirectMode === "custom" && (
                <Input placeholder="/login or https://…" {...register("redirectOnSuccess")} />
              )}
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label>If payment fails</Label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={failureMode === "inline"} onChange={() => setFailureMode("inline")} />
                Show inline message on the form
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={failureMode === "custom"} onChange={() => setFailureMode("custom")} />
                Redirect to custom URL
              </label>
              {failureMode === "custom" && <Input placeholder="https://…" {...register("redirectOnFailure")} />}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("autoCreateStudent")} />
              Auto-create student on payment
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("sendWelcomeEmail")} />
              Send welcome email with credentials
            </label>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={2} placeholder="Facebook Ads agency for South India" {...register("notes")} />
          </div>

          {environment === "test" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Test keys simulate checkout without real Razorpay charges.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || coursesLoading || !selectedCourseId}>
              {mutation.isPending ? "Generating…" : "Generate Key →"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
