"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  StudentRegistrationSchema,
  type StudentRegistrationInput,
} from "@/lib/validations/public-enrollment";

interface RegistrationModalProps {
  isOpen: boolean;
  onSubmit: (data: StudentRegistrationInput) => Promise<void>;
  isSubmitting: boolean;
  emailError?: string;
}

export function RegistrationModal({
  isOpen,
  onSubmit,
  isSubmitting,
  emailError,
}: RegistrationModalProps) {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<StudentRegistrationInput>({
    resolver: zodResolver(StudentRegistrationSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      collegeName: "",
      city: "",
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-bg-border bg-bg-card text-text-primary sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete Your Enrollment 🎉</DialogTitle>
          <DialogDescription className="text-text-muted">
            Payment successful! Set up your student account to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...form.register("name")} className="border-bg-border bg-bg-base" />
            {form.formState.errors.name && (
              <p className="text-xs text-status-red">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              className="border-bg-border bg-bg-base"
            />
            {emailError && <p className="text-xs text-status-red">{emailError}</p>}
            {emailError && (
              <Link href="/login" className="text-xs text-brand-cyan hover:underline">
                Go to Login →
              </Link>
            )}
            {form.formState.errors.email && !emailError && (
              <p className="text-xs text-status-red">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" {...form.register("phone")} className="border-bg-border bg-bg-base" />
            {form.formState.errors.phone && (
              <p className="text-xs text-status-red">{form.formState.errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                {...form.register("password")}
                className="border-bg-border bg-bg-base pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-status-red">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...form.register("confirmPassword")}
              className="border-bg-border bg-bg-base"
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-status-red">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="collegeName">College / Institution Name</Label>
            <Input
              id="collegeName"
              {...form.register("collegeName")}
              className="border-bg-border bg-bg-base"
            />
            {form.formState.errors.collegeName && (
              <p className="text-xs text-status-red">{form.formState.errors.collegeName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City (optional)</Label>
            <Input id="city" {...form.register("city")} className="border-bg-border bg-bg-base" />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-cyan text-bg-base hover:bg-brand-cyan-light"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create My Account & Start Learning →"
            )}
          </Button>

          <p className="text-center text-xs text-text-muted">
            Your LMS ID and login credentials will be emailed to you.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
