"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GoogleStatusPayload } from "@/lib/actions/googleIntegration";
import { parseApiJson } from "@/lib/utils";

export const GOOGLE_STATUS_KEY = ["google-status"] as const;

/** The signed-in user's own Google connection summary (no tokens). */
export function useGoogleStatus(options: { enabled?: boolean } = {}) {
  return useQuery<GoogleStatusPayload>({
    queryKey: GOOGLE_STATUS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/google/status", { cache: "no-store" });
      const json = await parseApiJson<GoogleStatusPayload & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Could not load Google status");
      return json;
    },
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  });
}

export type DisconnectResult = { ok: boolean; revokedAtGoogle: boolean; affectedUpcomingClasses: number };

export function useDisconnectGoogle(options: { platform?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation<DisconnectResult, Error>({
    mutationFn: async () => {
      const res = await fetch(options.platform ? "/api/google/disconnect?platform=1" : "/api/google/disconnect", {
        method: "POST",
      });
      const json = await parseApiJson<DisconnectResult & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Failed to disconnect Google");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GOOGLE_STATUS_KEY });
      qc.invalidateQueries({ queryKey: ["google-connections"] });
    },
  });
}

/** Host lookup used by the schedule form: is `userId` connected to Google? */
export type HostGoogleInfo = {
  userId: string;
  name: string;
  email: string | null;
  connected: boolean;
  status: "active" | "needs_reconnect" | "revoked" | null;
  googleEmail: string | null;
  isGmail: boolean;
};

export function useHostGoogleInfo(userId: string | null | undefined) {
  return useQuery<HostGoogleInfo>({
    queryKey: ["google-host-info", userId],
    queryFn: async () => {
      const res = await fetch(`/api/google/host-info?userId=${encodeURIComponent(userId as string)}`, { cache: "no-store" });
      const json = await parseApiJson<HostGoogleInfo & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Could not load host info");
      return json;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useRetryMeet() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: async (classId) => {
      const res = await fetch(`/api/live-classes/${classId}/retry-meet`, { method: "POST" });
      const json = await parseApiJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Could not retry Meet creation");
      return { ok: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-classes"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: GOOGLE_STATUS_KEY });
    },
  });
}

export type CalendarEventsRange = { start: string; end: string; includePast?: boolean };

export function useCalendarEvents(range: CalendarEventsRange | null) {
  return useQuery<unknown[]>({
    queryKey: ["calendar-events", range],
    queryFn: async () => {
      const params = new URLSearchParams({ start: range!.start, end: range!.end });
      if (range!.includePast) params.set("includePast", "1");
      const res = await fetch(`/api/calendar/events?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load calendar events");
      return res.json();
    },
    enabled: !!range,
  });
}

export { useGoogleConnections } from "@/components/integrations/GoogleConnectionsTable";

export function connectGoogleHref(returnTo?: string, options: { platform?: boolean } = {}): string {
  const path = returnTo ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const params = new URLSearchParams();
  if (path) params.set("returnTo", path);
  if (options.platform) params.set("platform", "1");
  const qs = params.toString();
  return qs ? `/api/google/connect?${qs}` : "/api/google/connect";
}
