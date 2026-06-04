"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { hrEmailSchema, hrOtpSchema, hrRegistrationSchema } from "@/lib/validations";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AuthPageBrand } from "@/components/brand/AuthPageBrand";

type HrEmailInput = z.infer<typeof hrEmailSchema>;
type HrOtpInput = z.infer<typeof hrOtpSchema>;
type HrRegistrationInput = z.infer<typeof hrRegistrationSchema>;

export default function HrRegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailForm = useForm<HrEmailInput>({ resolver: zodResolver(hrEmailSchema) });
  const otpForm = useForm<HrOtpInput>({ resolver: zodResolver(hrOtpSchema) });
  const regForm = useForm<HrRegistrationInput>({ resolver: zodResolver(hrRegistrationSchema) });

  const requestOtp = async (data: HrEmailInput) => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/hr/register/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "Failed to send OTP");
      return;
    }
    setVerifiedEmail(data.email.toLowerCase());
    otpForm.setValue("email", data.email.toLowerCase());
    setStep(2);
  };

  const verifyOtp = async (data: HrOtpInput) => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/hr/register/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "OTP verification failed");
      return;
    }
    regForm.setValue("email", verifiedEmail);
    setStep(3);
  };

  const completeRegistration = async (data: HrRegistrationInput) => {
    setLoading(true);
    setError("");
    const payload = { ...data, email: verifiedEmail };
    const res = await fetch("/api/hr/register/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "Registration failed");
      return;
    }
    window.location.href = "/hr/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-xl overflow-hidden p-0">
        <AuthPageBrand />
        <CardHeader className="space-y-1.5 px-6 pt-6 pb-4 text-center">
          <CardTitle>HR Registration</CardTitle>
          <CardDescription>
            Step {step} of 3 — {step === 1 ? "Company Email Verification" : step === 2 ? "OTP Verification" : "Company & HR Details"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          {step === 1 && (
            <form onSubmit={emailForm.handleSubmit(requestOtp)} className="space-y-4">
              <div className="space-y-2">
                <Label>Official Company Email</Label>
                <Input type="email" placeholder="hr@company.com" {...emailForm.register("email")} />
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" disabled={loading}>{loading ? "Sending OTP..." : "Send OTP"}</Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={otpForm.handleSubmit(verifyOtp)} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" readOnly {...otpForm.register("email")} />
              </div>
              <div className="space-y-2">
                <Label>OTP</Label>
                <Input placeholder="6 digit OTP" {...otpForm.register("otp")} />
                {otpForm.formState.errors.otp && (
                  <p className="text-sm text-destructive">{otpForm.formState.errors.otp.message}</p>
                )}
              </div>
              <Button type="submit" disabled={loading}>{loading ? "Verifying..." : "Verify OTP"}</Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={regForm.handleSubmit(completeRegistration)} className="space-y-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input {...regForm.register("companyName")} />
              </div>
              <div className="space-y-2">
                <Label>HR Full Name</Label>
                <Input {...regForm.register("name")} />
              </div>
              <div className="space-y-2">
                <Label>Designation (optional)</Label>
                <Input {...regForm.register("designation")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input readOnly value={verifiedEmail} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" {...regForm.register("password")} />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" {...regForm.register("confirmPassword")} />
              </div>
              <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create HR Account"}</Button>
            </form>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

