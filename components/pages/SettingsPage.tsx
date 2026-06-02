"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, changePasswordSchema } from "@/lib/validations";
import type { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type ProfileInput = z.infer<typeof profileSchema>;
type PasswordInput = z.infer<typeof changePasswordSchema>;

async function parseApiError(res: Response): Promise<never> {
  const json = await res.json().catch(() => ({}));
  const message =
    typeof json.error === "string"
      ? json.error
      : json.error?.formErrors?.[0] ?? "Something went wrong";
  throw new Error(message);
}

export function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetch("/api/profile").then((r) => r.json()),
  });

  const organisationLogoUrl = (profile as any)?.logoUrl as string | null | undefined;
  const role = (profile as any)?.role as string | undefined;

  const [logoDraft, setLogoDraft] = useState<string | null | undefined>(undefined);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    // Reset draft when user/organisation changes
    setLogoDraft(undefined);
    setLogoError(null);
  }, [organisationLogoUrl]);

  const logoPreview = logoDraft !== undefined ? logoDraft : organisationLogoUrl ?? null;

  const updateOrganisationLogo = useMutation({
    mutationFn: async (logoUrl: string | null) => {
      const res = await fetch("/api/organisation-logo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
      });
      if (!res.ok) await parseApiError(res);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setLogoDraft(undefined);
      setLogoError(null);
    },
  });

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? { name: profile.name, email: profile.email, phone: profile.phone || "" }
      : undefined,
  });

  const passwordForm = useForm<PasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const updateProfile = useMutation({
    mutationFn: async (data: ProfileInput) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) await parseApiError(res);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      profileForm.reset(profileForm.getValues());
    },
  });

  const changePassword = useMutation({
    mutationFn: async (data: PasswordInput) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) await parseApiError(res);
      return res.json();
    },
    onSuccess: () => {
      passwordForm.reset();
    },
  });

  const initials = profile?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="space-y-6 max-w-2xl w-full">
      <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{profile?.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            {profile?.lmsId && <p className="text-xs font-mono text-primary">LMS ID: {profile.lmsId}</p>}
            {profile?.orgName && <p className="text-xs text-muted-foreground">{profile.orgName}</p>}
            {profile?.collegeName && <p className="text-xs text-muted-foreground">{profile.collegeName}</p>}
          </div>
        </CardHeader>
      </Card>

      {role === "org_admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organisation Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                {logoPreview ? (
                  // Use <img> since logoUrl might be a data URL
                  <img
                    src={logoPreview}
                    alt="Organisation logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload a logo for your organisation. It will be visible to students in this organisation.
                </p>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoError(null);
                    // Avoid huge payloads stored as data URLs
                    if (file.size > 450 * 1024) {
                      setLogoError("Logo image is too large. Please use a file under 450KB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setLogoDraft(String(reader.result));
                    };
                    reader.onerror = () => setLogoError("Failed to read the selected file.");
                    reader.readAsDataURL(file);
                  }}
                />
                {logoError && <p className="text-sm text-destructive">{logoError}</p>}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="secondary"
                disabled={updateOrganisationLogo.isPending || logoPreview === (organisationLogoUrl ?? null)}
                onClick={() => updateOrganisationLogo.mutate(logoDraft ?? null)}
              >
                {updateOrganisationLogo.isPending ? "Saving..." : "Save Logo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={updateOrganisationLogo.isPending || !logoPreview}
                onClick={() => setLogoDraft(null)}
              >
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...profileForm.register("name")} />
              {profileForm.formState.errors.name && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...profileForm.register("email")} />
              {profileForm.formState.errors.email && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.email.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                After changing email, sign out and sign in again with the new address.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...profileForm.register("phone")} />
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
            {updateProfile.isSuccess && (
              <p className="text-sm text-emerald-400">Profile updated!</p>
            )}
            {updateProfile.isError && (
              <p className="text-sm text-destructive">{(updateProfile.error as Error).message}</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit((d) => changePassword.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" autoComplete="current-password" {...passwordForm.register("currentPassword")} />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" autoComplete="new-password" {...passwordForm.register("newPassword")} />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" autoComplete="new-password" {...passwordForm.register("confirmPassword")} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating..." : "Update Password"}
            </Button>
            {changePassword.isSuccess && (
              <p className="text-sm text-emerald-400">Password updated successfully!</p>
            )}
            {changePassword.isError && (
              <p className="text-sm text-destructive">{(changePassword.error as Error).message}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
