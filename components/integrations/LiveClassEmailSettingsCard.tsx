"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { parseApiJson } from "@/lib/utils";

type Prefs = { scope: "system" | "organisation"; emailMentor: boolean; emailStudents: boolean };

/**
 * Org Admin / Super Admin: choose whether the LMS also sends its own branded "class scheduled"
 * email on top of the Google Calendar invite. Students default OFF to avoid duplicate emails.
 */
export function LiveClassEmailSettingsCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Prefs>({
    queryKey: ["live-class-email-settings"],
    queryFn: async () => {
      const res = await fetch("/api/live-class-email-settings", { cache: "no-store" });
      const json = await parseApiJson<Prefs & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Could not load settings");
      return json;
    },
  });

  const [draft, setDraft] = useState<{ emailMentor: boolean; emailStudents: boolean } | null>(null);
  useEffect(() => {
    if (data) setDraft({ emailMentor: data.emailMentor, emailStudents: data.emailStudents });
  }, [data]);

  const save = useMutation({
    mutationFn: async (prefs: { emailMentor: boolean; emailStudents: boolean }) => {
      const res = await fetch("/api/live-class-email-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-class-email-settings"] }),
  });

  const dirty = !!data && !!draft && (draft.emailMentor !== data.emailMentor || draft.emailStudents !== data.emailStudents);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5 text-swiss-red" />
          Live class emails
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          When a class is created through Google, Google Calendar already emails the invite. Choose whether{" "}
          {data?.scope === "system" ? "direct (non-organisation) " : "your "}
          students and mentors also get the LMS email with the join button.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !draft ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-swiss-red"
                checked={draft.emailMentor}
                onChange={(e) => setDraft({ ...draft, emailMentor: e.target.checked })}
              />
              <span>
                <span className="font-medium">Email the mentor / host</span>
                <span className="block text-muted-foreground">
                  Branded confirmation with the class details and the Google Calendar link.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-swiss-red"
                checked={draft.emailStudents}
                onChange={(e) => setDraft({ ...draft, emailStudents: e.target.checked })}
              />
              <span>
                <span className="font-medium">Email students</span>
                <span className="block text-muted-foreground">
                  Off by default — students already receive the Google invite. Turn on if your students do not use
                  Google Calendar. WhatsApp notifications are unaffected.
                </span>
              </span>
            </label>
            <div className="flex items-center gap-3">
              <Button type="button" size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
              {save.isSuccess && !dirty && <span className="text-sm text-emerald-600">Saved.</span>}
              {save.isError && <span className="text-sm text-destructive">{save.error.message}</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
