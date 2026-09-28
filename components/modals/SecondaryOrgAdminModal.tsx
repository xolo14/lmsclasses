"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { secondaryOrgAdminSchema } from "@/lib/validations";
import { z } from "zod";
import { formatApiError } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

type SecondaryInput = z.infer<typeof secondaryOrgAdminSchema>;

type SecondaryRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean | null;
};

export function SecondaryOrgAdminModal({
  open,
  onOpenChange,
  organisationId,
  organisationName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisationId: string;
  organisationName: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { data: secondaries = [] } = useQuery<SecondaryRow[]>({
    queryKey: ["org-secondary-admins", organisationId],
    queryFn: async () => {
      const res = await fetch(`/api/organisations/${organisationId}/secondary-admins`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load secondary logins");
      return Array.isArray(json) ? json : [];
    },
    enabled: open && !!organisationId,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SecondaryInput>({
    resolver: zodResolver(secondaryOrgAdminSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ name: "", email: "", password: "", confirmPassword: "" });
      setError("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: SecondaryInput) => {
      const res = await fetch(`/api/organisations/${organisationId}/secondary-admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(json.error, "Failed to save secondary login"));
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-secondary-admins", organisationId] });
      reset({ name: "", email: "", password: "", confirmPassword: "" });
      setError("");
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-w-sm">
        <DialogHeader>
          <DialogTitle>Secondary mail</DialogTitle>
          <DialogDescription>
            Extra org-admin login for {organisationName}. They sign in at the same login page.
          </DialogDescription>
        </DialogHeader>
        {secondaries.length > 0 && (
          <div className="space-y-1 rounded-md border border-border p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Existing secondary logins
            </p>
            {secondaries.map((row) => (
              <p key={row.id} className="truncate">
                {row.name} · {row.email}
              </p>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" autoComplete="off" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                className="pr-10"
                autoComplete="new-password"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                className="pr-10"
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save login"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
