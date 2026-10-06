"use client";

import { useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { portalHomeForRole, ROLE_ROUTES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { AuthPageBrand } from "@/components/brand/AuthPageBrand";
import { SwissAuthShell } from "@/components/layout/SwissAuthShell";
import { LMS_APP_NAME } from "@/lib/branding";

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (code === "GoogleNotRegistered" || code === "AccessDenied") {
      setError("No LMS account uses that Google email. Sign in with your LMS email and password, or ask an admin to add you first.");
    }
  }, []);

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error || result?.ok === false) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      const session = await getSession();
      const role = session?.user?.role;

      if (!role) {
        setError(
          "Signed in but no session cookie. Set NEXTAUTH_URL to your exact site URL (http:// or https://), AUTH_TRUST_HOST=true, and AUTH_SECRET, then redeploy."
        );
        setLoading(false);
        return;
      }

      window.location.href = portalHomeForRole(role) || (role && ROLE_ROUTES[role] ? `${ROLE_ROUTES[role]}/dashboard` : "/");
    } catch (err: any) {
      console.error("[Login Error]", err);
      setError(
        "Too many sign-in attempts or network issue. Please wait 15 minutes or try from a different network."
      );
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    await signIn("google", { callbackUrl: "/auth/continue" });
  };

  return (
    <SwissAuthShell title="Sign In" subtitle="Student & staff portal">
      <Card className="w-full overflow-hidden p-0 border-swiss-black/10 shadow-none rounded-sm">
        <AuthPageBrand />
        <CardHeader className="space-y-1.5 px-6 pt-6 pb-4 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">{LMS_APP_NAME}</CardTitle>
          <CardDescription className="text-swiss-muted">Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <noscript>
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              JavaScript is required to sign in. If the page looks unstyled, hard-refresh (Ctrl+F5) or
              clear your browser cache, then try again.
            </p>
          </noscript>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          {googleEnabled && (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-swiss-black/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-[0.14em] text-swiss-muted">
                  <span className="bg-card px-2">or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading || googleLoading}
                onClick={() => void onGoogle()}
              >
                <GoogleMark />
                {googleLoading ? "Opening Google..." : "Sign in with Google"}
              </Button>
              <p className="text-center text-xs text-swiss-muted">
                Only existing LMS accounts. The Google email must match your LMS email.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </SwissAuthShell>
  );
}
