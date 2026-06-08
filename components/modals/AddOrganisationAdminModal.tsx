"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { organisationSchema, editOrganisationSchema } from "@/lib/validations";
import { z } from "zod";
import { formatApiError } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EditOrgInput = z.infer<typeof editOrganisationSchema>;

export type OrganisationRow = {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  adminName?: string | null;
  adminEmail?: string | null;
  jobPortalAccess?: boolean;
};

interface AddOrganisationAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisation?: OrganisationRow;
}

export function AddOrganisationAdminModal({
  open,
  onOpenChange,
  organisation,
}: AddOrganisationAdminModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [statusActive, setStatusActive] = useState(true);
  const [jobPortalAccess, setJobPortalAccess] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isEdit = !!organisation;

  const formValues = useMemo<EditOrgInput>(
    () =>
      organisation
        ? {
            orgName: organisation.name,
            adminName: organisation.adminName ?? "",
            email: organisation.adminEmail ?? organisation.email ?? "",
            phone: organisation.phone ?? "",
            password: "",
            confirmPassword: "",
            address: organisation.address ?? "",
            isActive: organisation.isActive,
          }
        : {
            orgName: "",
            adminName: "",
            email: "",
            phone: "",
            password: "",
            confirmPassword: "",
            address: "",
          },
    [organisation]
  );

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditOrgInput>({
    resolver: zodResolver(isEdit ? editOrganisationSchema : organisationSchema),
    values: formValues,
  });

  useEffect(() => {
    if (open) {
      reset(formValues);
      setStatusActive(organisation?.isActive ?? true);
      setJobPortalAccess(organisation?.jobPortalAccess ?? true);
      setError("");
    }
  }, [open, formValues, reset, organisation]);

  const mutation = useMutation({
    mutationFn: async (data: EditOrgInput) => {
      const url = isEdit ? `/api/organisations/${organisation!.id}` : "/api/organisations";
      const method = isEdit ? "PATCH" : "POST";
      const payload = isEdit
        ? { ...data, isActive: statusActive, jobPortalAccess, ...(data.password ? {} : { password: undefined }) }
        : { ...data, jobPortalAccess };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(json.error, "Failed to save organisation"));
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
      if (!isEdit) reset(formValues);
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Organisation" : "Add Organisation Admin"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Organisation Name</Label>
            <Input {...register("orgName")} />
            {errors.orgName && <p className="text-sm text-destructive">{errors.orgName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Admin Name</Label>
            <Input {...register("adminName")} />
            {errors.adminName && <p className="text-sm text-destructive">{errors.adminName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label>{isEdit ? "New Password (optional)" : "Password"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                className="pr-10"
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
            <Label>{isEdit ? "Confirm New Password" : "Confirm Password"}</Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                className="pr-10"
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
          <div className="space-y-2">
            <Label>Address</Label>
            <Input {...register("address")} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3 shadow-sm bg-muted/10">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Job Portal & Applications Access</Label>
              <p className="text-xs text-muted-foreground">
                Allow all students of this organisation to view jobs and submit applications.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setJobPortalAccess(!jobPortalAccess)}
              className={`${
                jobPortalAccess ? "bg-primary" : "bg-muted"
              } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
            >
              <span
                className={`${
                  jobPortalAccess ? "translate-x-5" : "translate-x-0"
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
          {isEdit && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusActive ? "active" : "inactive"}
                onValueChange={(v) => setStatusActive(v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
