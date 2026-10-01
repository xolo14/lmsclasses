"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { wrapApiForm } from "@/lib/api-url-transport";
import { GOOGLE_STATUS_KEY, useGoogleStatus } from "@/lib/hooks/useGoogle";
import { parseApiJson } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

type Mode = "google_platform" | "google_host";

export function DefaultMeetModeCard() {
  const qc = useQueryClient();
  const { data } = useGoogleStatus();
  const [mode, setMode] = useState<Mode>("google_platform");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.defaultMeetMode) setMode(data.defaultMeetMode);
  }, [data?.defaultMeetMode]);

  const save = async (next: Mode) => {
    setMode(next);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/google/platform-settings", {
        method: "PATCH",
        body: wrapApiForm({ defaultMeetMode: next }),
      });
      const json = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Could not save default");
      setMessage("Default saved.");
      void qc.invalidateQueries({ queryKey: GOOGLE_STATUS_KEY });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save default");
    } finally {
      setSaving(false);
    }
  };

  const email = data?.platformEmail ?? "info@lmsclasses.com";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Default live class host</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          New classes use this mode unless the scheduler picks something else.
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-swiss-red"
            checked={mode === "google_platform"}
            disabled={saving}
            onChange={() => void save("google_platform")}
          />
          <span>
            <span className="text-sm font-medium">Platform account ({email})</span>
            <span className="block text-xs text-muted-foreground">Recommended. One calendar hosts every class.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-swiss-red"
            checked={mode === "google_host"}
            disabled={saving}
            onChange={() => void save("google_host")}
          />
          <span>
            <span className="text-sm font-medium">Assigned mentor&apos;s Google account</span>
            <span className="block text-xs text-muted-foreground">Requires each mentor to connect Google.</span>
          </span>
        </label>
        {message && <p className="text-xs text-muted-foreground">{saving ? "Saving…" : message}</p>}
      </CardContent>
    </Card>
  );
}
