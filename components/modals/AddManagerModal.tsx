"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { managerSchema, editManagerSchema } from "@/lib/validations";
import { z } from "zod";
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

type EditUserInput = z.infer<typeof editManagerSchema>;

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

interface AddManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiPath?: string;
  title?: string;
  user?: UserRow;
}

export function AddManagerModal({
  open,
  onOpenChange,
  apiPath = "/api/managers",
  title = "Add Manager",
  user,
}: AddManagerModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isEdit = !!user;

  const formValues = useMemo<EditUserInput>(
    () =>
      user
        ? {
            name: user.name,
            email: user.email,
            phone: user.phone ?? "",
            password: "",
            confirmPassword: "",
          }
        : {
            name: "",
            email: "",
            phone: "",
            password: "",
            confirmPassword: "",
          },
    [user]
  );

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditUserInput>({
    resolver: zodResolver(isEdit ? editManagerSchema : managerSchema),
    values: formValues,
  });

  useEffect(() => {
    if (open) {
      reset(formValues);
      setError("");
    }
  }, [open, formValues, reset]);

  const mutation = useMutation({
    mutationFn: async (data: EditUserInput) => {
      const url = isEdit ? `${apiPath}/${user!.id}` : apiPath;
      const method = isEdit ? "PATCH" : "POST";
      const payload = isEdit
        ? {
            name: data.name,
            email: data.email,
            phone: data.phone,
            ...(data.password ? { password: data.password } : {}),
          }
        : data;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save user");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      queryClient.invalidateQueries({ queryKey: ["mentors"] });
      if (!isEdit) reset({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
      onOpenChange(false);
    },
    onError: (err) => setError(err.message),
  });

  const dialogTitle = isEdit
    ? title?.replace("Add", "Edit") ?? "Edit User"
    : title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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
            <Label>{isEdit ? "New password (leave blank to keep current)" : "Password"}</Label>
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
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{isEdit ? "Confirm new password" : "Confirm Password"}</Label>
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddMentorModal(props: Omit<AddManagerModalProps, "apiPath" | "title">) {
  return <AddManagerModal {...props} apiPath="/api/mentors" title="Add Mentor" />;
}
