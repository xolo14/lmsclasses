"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Film } from "lucide-react";
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

interface AddRecordingAccessKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GeneratedKey = {
  key: string;
  id: string;
  name: string;
  courseTitles: string[];
  recordingsEndpoint: string;
};

export function AddRecordingAccessKeyModal({
  open,
  onOpenChange,
}: AddRecordingAccessKeyModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [notes, setNotes] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [domainsInput, setDomainsInput] = useState("");

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

  useEffect(() => {
    if (open) {
      setError("");
      setGenerated(null);
      setCopied(false);
      setName("");
      setEnvironment("live");
      setNotes("");
      setSelectedCourseIds([]);
      setDomainsInput("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const domains = domainsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/super-admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyType: "recordings",
          name,
          allowedCourses: selectedCourseIds,
          environment,
          notes: notes || null,
          widgetDomainsAllowed: domains,
          autoCreateStudent: false,
          sendWelcomeEmail: false,
        }),
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
        id: data.id,
        name: data.name,
        courseTitles: data.courseTitles ?? [],
        recordingsEndpoint: data.recordingsEndpoint ?? "/api/external/recordings",
      });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const copyKey = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (generated) {
    return (
      <Dialog
        open={open}
        onOpenChange={() => {
          setGenerated(null);
          onOpenChange(false);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[min(90dvh,90vh)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recording Access Key — {generated.name}</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              Save the API key now — it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-swiss-black/10 bg-swiss-cream/50 p-3 text-sm space-y-1">
            <p className="font-medium">Courses with video access</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {generated.courseTitles.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-2">
              Partner endpoint:{" "}
              <code className="font-mono">GET {generated.recordingsEndpoint}</code>
              <br />
              Header: <code className="font-mono">Authorization: Bearer &lt;api_key&gt;</code>
            </p>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Key</Label>
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mt-1">
              <code className="block break-all text-sm font-mono">{generated.key}</code>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={copyKey}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied" : "Copy API Key"}
            </Button>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setGenerated(null);
                onOpenChange(false);
              }}
            >
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
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Create Recording Access Key
          </DialogTitle>
          <DialogDescription>
            Partner site key for fetching published recording-class videos. Select one or more
            record courses this key may access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>Key Name</Label>
            <Input
              placeholder="Partner-Video-Access"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label>Record courses *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Multi-select — partner can load videos only for checked courses.
            </p>
            {coursesLoading ? (
              <p className="text-sm text-muted-foreground">Loading courses…</p>
            ) : coursesError ? (
              <p className="text-sm text-destructive">Could not load courses.</p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-destructive">No active record courses found.</p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {courses.map((c) => {
                  const checked = selectedCourseIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-start gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleCourse(c.id)}
                      />
                      <span>
                        <span className="font-medium">{c.name}</span>
                        {c.price !== undefined && (
                          <span className="text-muted-foreground">
                            {" "}
                            — ₹{c.price.toLocaleString("en-IN")}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedCourseIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedCourseIds.length} course{selectedCourseIds.length === 1 ? "" : "s"}{" "}
                selected
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Environment</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as "live" | "test")}
              >
                <option value="live">Live (lms_live_…)</option>
                <option value="test">Test (lms_test_…)</option>
              </select>
            </div>
            <div>
              <Label>Allowed Domains (optional)</Label>
              <Input
                placeholder="partner-site.com"
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              placeholder="Video CDN partner for recording classes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              mutation.isPending ||
              name.trim().length < 2 ||
              selectedCourseIds.length === 0
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Generating…" : "Generate Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
