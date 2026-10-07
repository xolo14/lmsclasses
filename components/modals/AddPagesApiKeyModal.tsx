"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_PAGES } from "@/lib/api-key-types";
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

interface AddPagesApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GeneratedKey = {
  key: string;
  name: string;
  pages: string[];
  pagesEndpoint: string;
};

export function AddPagesApiKeyModal({ open, onOpenChange }: AddPagesApiKeyModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEnvironment("live");
      setSelected([]);
      setError("");
      setGenerated(null);
      setCopied(false);
    }
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/super-admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyType: "pages",
          name,
          environment,
          pages: selected,
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
        throw new Error([json.error, detail].filter(Boolean).join(" — ") || "Failed to generate key");
      }
      return json;
    },
    onSuccess: (data) => {
      setGenerated({
        key: data.key,
        name: data.name,
        pages: data.pages ?? [],
        pagesEndpoint: data.pagesEndpoint ?? "/api/external/pages",
      });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const copyKey = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (generated) {
    return (
      <Dialog open={open} onOpenChange={() => { setGenerated(null); onOpenChange(false); }}>
        <DialogContent className="max-w-lg max-h-[min(90dvh,90vh)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pages API Key Generated — {generated.name}</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              Save the API key now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {generated.pages.map((page) => (
                <span
                  key={page}
                  className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
                >
                  {page}
                </span>
              ))}
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Key</Label>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mt-1">
                <code className="block break-all text-sm font-mono">{generated.key}</code>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => void copyKey()}>
                {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? "Copied" : "Copy key"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Other platforms send{" "}
              <code className="font-mono">Authorization: Bearer {"<key>"}</code> to{" "}
              <code className="font-mono">{generated.pagesEndpoint}/{"{page}"}</code>.
              Selected pages can be read and written.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setGenerated(null); onOpenChange(false); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90dvh,90vh)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pages API Key</DialogTitle>
          <DialogDescription>
            Select LMS pages. The generated key lets another platform read and write only those pages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner pages key" />
          </div>
          <div className="space-y-2">
            <Label>Environment</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as "live" | "test")}
            >
              <option value="live">Live</option>
              <option value="test">Test</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pages</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setSelected((prev) =>
                    prev.length === API_PAGES.length ? [] : API_PAGES.map((p) => p.id)
                  )
                }
              >
                {selected.length === API_PAGES.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {API_PAGES.map((page) => (
                <label
                  key={page.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(page.id)}
                    onChange={() => toggle(page.id)}
                  />
                  {page.label}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || selected.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
