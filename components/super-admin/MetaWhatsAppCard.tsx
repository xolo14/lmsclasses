"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MessageCircle } from "lucide-react";

type WhatsAppStatus = {
  configured: boolean;
  templateName: string;
  languageCode: string;
  countryCode: string;
  hasToken: boolean;
  phoneNumberIdSet: boolean;
  apiVersion: string;
  message?: string;
  triggers?: string[];
};

type TestResult = {
  ok: boolean;
  configured: boolean;
  send: { ok: boolean; error?: string; messageId?: string };
  hint?: string;
};

export function MetaWhatsAppCard() {
  const [phone, setPhone] = useState("");
  const [studentName, setStudentName] = useState("Test Student");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data, isLoading, refetch } = useQuery<WhatsAppStatus>({
    queryKey: ["whatsapp-status"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/whatsapp-status");
      if (!res.ok) throw new Error("Could not load WhatsApp status");
      return res.json();
    },
  });

  const testSend = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/super-admin/whatsapp-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, studentName: studentName || undefined }),
      });
      const json = (await res.json()) as TestResult & { error?: string };
      if (!res.ok && !json.send) {
        throw new Error(json.error ?? "Test send failed");
      }
      return json;
    },
    onSuccess: (result) => setTestResult(result),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            WhatsApp (Meta Cloud API)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sends live class meeting links to enrolled students via Meta WhatsApp templates.
          </p>
        </div>
        {!isLoading && (
          <Badge variant={data?.configured ? "success" : "secondary"}>
            {data?.configured ? "Connected" : "Not configured"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Checking configuration…</p>
        ) : (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Access token:</span>{" "}
                {data?.hasToken ? "Set on server" : "Missing"}
              </div>
              <div>
                <span className="text-muted-foreground">Phone number ID:</span>{" "}
                {data?.phoneNumberIdSet ? "Set on server" : "Missing"}
              </div>
              <div>
                <span className="text-muted-foreground">Template:</span>{" "}
                <code className="text-xs">{data?.templateName ?? "—"}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Language:</span> {data?.languageCode ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Default country:</span>{" "}
                {data?.countryCode ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">API version:</span> {data?.apiVersion ?? "—"}
              </div>
            </div>

            {!data?.configured && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 text-sm">
                <p className="font-medium text-amber-200">Setup on Meta + Hostinger</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    Open{" "}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline inline-flex items-center gap-1"
                    >
                      Meta Developer App <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    → WhatsApp → API Setup
                  </li>
                  <li>
                    Copy <strong>Temporary/Permanent access token</strong> and{" "}
                    <strong>Phone number ID</strong>
                  </li>
                  <li>
                    Create/approve template <code className="text-xs">live_class_link</code> with body
                    variables {"{{1}}"}–{"{{5}}"} and a dynamic URL button{" "}
                    <code className="text-xs">https://{"{{1}}"}</code>
                  </li>
                  <li>
                    In Hostinger hPanel → Node.js → Environment variables, set:
                    <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
{`META_WHATSAPP_TOKEN=EAAxxxx...
META_WHATSAPP_PHONE_NUMBER_ID=123456789012345
META_WHATSAPP_TEMPLATE_NAME=live_class_link
META_WHATSAPP_TEMPLATE_LANGUAGE=en
META_WHATSAPP_COUNTRY_CODE=+91`}
                    </pre>
                  </li>
                  <li>Restart the Node app, then refresh this page</li>
                </ol>
              </div>
            )}

            {data?.triggers && data.triggers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Automatic triggers</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {data.triggers.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-border p-4 space-y-4">
              <p className="text-sm font-medium">Send test WhatsApp</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="meta-wa-test-phone">Phone (10 digits or +91…)</Label>
                  <Input
                    id="meta-wa-test-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-wa-test-name">Student name (greeting)</Label>
                  <Input
                    id="meta-wa-test-name"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!data?.configured || testSend.isPending || phone.trim().length < 10}
                  onClick={() => testSend.mutate()}
                >
                  {testSend.isPending ? "Sending…" : "Send test message"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refetch()}>
                  Refresh status
                </Button>
              </div>
              {testSend.isError && (
                <p className="text-sm text-destructive">{(testSend.error as Error).message}</p>
              )}
              {testResult && (
                <div className="text-sm space-y-1">
                  <p className={testResult.ok ? "text-emerald-400" : "text-destructive"}>
                    {testResult.ok ? "Test message sent — check WhatsApp." : "Test failed."}
                  </p>
                  {!testResult.send.ok && (
                    <p className="text-muted-foreground">Send: {testResult.send.error}</p>
                  )}
                  {testResult.send.ok && testResult.send.messageId && (
                    <p className="text-muted-foreground text-xs">
                      Message ID: {testResult.send.messageId}
                    </p>
                  )}
                  {testResult.hint && (
                    <p className="text-muted-foreground text-xs">{testResult.hint}</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
