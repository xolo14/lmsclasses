"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type HrSettings = {
  name: string;
  email: string;
  designation: string | null;
  logoUrl: string | null;
  companyName: string;
  companyDomain: string;
  companyWebsite: string | null;
  companyVerificationStatus: string;
};

async function parseError(res: Response) {
  const data = await res.json().catch(() => ({}));
  const flat = data?.error;
  if (typeof flat === "string") return flat;
  if (flat?.formErrors?.length) return flat.formErrors.join(". ");
  return "Something went wrong";
}

export default function HrSettingsPage() {
  const { data, isLoading, refetch } = useQuery<HrSettings>({
    queryKey: ["hr-settings"],
    queryFn: async () => {
      const res = await fetch("/api/hr/settings");
      if (!res.ok) throw new Error(await parseError(res));
      return res.json();
    },
  });

  const [form, setForm] = useState({
    name: "",
    designation: "",
    companyName: "",
    companyWebsite: "",
    logoUrl: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name || "",
      designation: data.designation || "",
      companyName: data.companyName || "",
      companyWebsite: data.companyWebsite || "",
      logoUrl: data.logoUrl || "",
    });
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hr/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          designation: form.designation || null,
          companyName: form.companyName,
          companyWebsite: form.companyWebsite || null,
          logoUrl: form.logoUrl || null,
        }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("New password and confirm password do not match.");
      }
      const res = await fetch("/api/hr/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      return res.json();
    },
    onSuccess: () => setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }),
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/hr-logo", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await parseError(res));
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (payload) => setForm((prev) => ({ ...prev, logoUrl: payload.url })),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading settings...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">HR Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile & Company</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={data?.email || ""} disabled />
          </div>
          <div className="space-y-1">
            <Label>Designation</Label>
            <Input value={form.designation} onChange={(e) => setForm((s) => ({ ...s, designation: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Company Name</Label>
            <Input value={form.companyName} onChange={(e) => setForm((s) => ({ ...s, companyName: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Company Domain</Label>
            <Input value={data?.companyDomain || ""} disabled />
          </div>
          <div className="space-y-1">
            <Label>Company Website</Label>
            <Input
              value={form.companyWebsite}
              onChange={(e) => setForm((s) => ({ ...s, companyWebsite: e.target.value }))}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Verification Status</Label>
            <Input value={data?.companyVerificationStatus || ""} disabled />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Company logo" className="h-12 w-12 rounded border border-border object-contain" />
              ) : (
                <span className="inline-block h-12 w-12 rounded border border-border bg-muted/30" />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo.mutate(file);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Allowed: png, jpg, webp, gif (max 2MB)</p>
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {saveProfile.isPending ? "Saving..." : "Save Settings"}
            </Button>
            {saveProfile.isError && <p className="mt-2 text-sm text-destructive">{(saveProfile.error as Error).message}</p>}
            {saveProfile.isSuccess && <p className="mt-2 text-sm text-emerald-500">Settings updated.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Current Password</Label>
            <Input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((s) => ({ ...s, currentPassword: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>New Password</Label>
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((s) => ({ ...s, newPassword: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((s) => ({ ...s, confirmPassword: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating..." : "Change Password"}
            </Button>
            {changePassword.isError && <p className="mt-2 text-sm text-destructive">{(changePassword.error as Error).message}</p>}
            {changePassword.isSuccess && <p className="mt-2 text-sm text-emerald-500">Password changed successfully.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

