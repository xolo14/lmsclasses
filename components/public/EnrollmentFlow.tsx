"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RegistrationModal } from "@/components/public/RegistrationModal";
import { trackGoogleAdsPurchase } from "@/lib/google-ads";
import type { StudentRegistrationInput } from "@/lib/validations/public-enrollment";

type FlowState =
  | "IDLE"
  | "PAYMENT_INIT"
  | "PAYMENT_PROCESSING"
  | "PAYMENT_SUCCESS"
  | "REGISTRATION"
  | "CREATING"
  | "DONE"
  | "PAYMENT_FAILED";

interface EnrollmentFlowProps {
  courseId: string;
  courseTitle: string;
  price: number;
  trigger: React.ReactNode;
}

type PaymentPayload = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export function EnrollmentFlow({ courseId, courseTitle, price, trigger }: EnrollmentFlowProps) {
  const router = useRouter();
  const [state, setState] = useState<FlowState>("IDLE");
  const [paymentData, setPaymentData] = useState<PaymentPayload | null>(null);
  const [emailError, setEmailError] = useState<string>();
  const [bannerError, setBannerError] = useState<string>();
  const [doneEmail, setDoneEmail] = useState("");
  const [doneLmsId, setDoneLmsId] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [plainPassword, setPlainPassword] = useState<string | null>(null);

  const startPayment = useCallback(async () => {
    setState("PAYMENT_INIT");
    setBannerError(undefined);
    setEmailError(undefined);

    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, amount: price, source: "public" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment");

      if (!data.key || !data.orderId) {
        throw new Error("Invalid payment session");
      }
      if (!window.Razorpay) {
        throw new Error("Razorpay checkout failed to load. Refresh and try again.");
      }

      setState("PAYMENT_PROCESSING");

      const options = {
        key: data.key,
        amount: Math.round(data.amount * 100),
        currency: data.currency,
        name: "LMSClasses",
        description: courseTitle,
        order_id: data.orderId,
        theme: { color: "#00C2E0" },
        handler: (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          setPaymentData({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          setState("REGISTRATION");
        },
        modal: {
          ondismiss: () => setState("IDLE"),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setBannerError(response.error?.description || "Payment failed");
        setState("PAYMENT_FAILED");
      });
      rzp.open();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Payment failed");
      setState("PAYMENT_FAILED");
    }
  }, [courseId, courseTitle, price]);

  const handleRegistration = async (studentData: StudentRegistrationInput) => {
    if (!paymentData) return;
    setState("CREATING");
    setEmailError(undefined);
    setBannerError(undefined);
    setPlainPassword(studentData.password);

    try {
      const res = await fetch("/api/public/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          courseId,
          paymentData,
          studentData,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setEmailError("This email is already registered. Please login.");
        setState("REGISTRATION");
        return;
      }

      if (!res.ok) {
        setBannerError(
          `Account creation failed. Your payment was recorded. Contact support with payment ID: ${paymentData.razorpayPaymentId}`
        );
        setState("REGISTRATION");
        return;
      }

      setDoneEmail(data.user.email);
      setDoneLmsId(data.user.lmsId);
      setState("DONE");
      trackGoogleAdsPurchase(paymentData.razorpayPaymentId);
    } catch {
      setBannerError(
        `Account creation failed. Your payment was recorded. Contact support with payment ID: ${paymentData.razorpayPaymentId}`
      );
      setState("REGISTRATION");
    }
  };

  useEffect(() => {
    if (state !== "DONE") return;
    if (countdown <= 0) {
      router.push("/student/courses");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [state, countdown, router]);

  const goToCourses = async () => {
    if (plainPassword && doneEmail) {
      await signIn("credentials", {
        email: doneEmail,
        password: plainPassword,
        redirect: false,
      });
      setPlainPassword(null);
    }
    router.push("/student/courses");
  };

  return (
    <>
      <div onClick={startPayment} role="presentation">
        {trigger}
      </div>

      <RegistrationModal
        isOpen={state === "REGISTRATION" || state === "CREATING"}
        onSubmit={handleRegistration}
        isSubmitting={state === "CREATING"}
        emailError={emailError}
      />

      {(state === "CREATING" || state === "PAYMENT_FAILED") && bannerError && (
        <Dialog open onOpenChange={() => setState("IDLE")}>
          <DialogContent className="border-bg-border bg-bg-card text-text-primary">
            <p className="text-status-red">{bannerError}</p>
          </DialogContent>
        </Dialog>
      )}

      {state === "CREATING" && !bannerError && (
        <Dialog open>
          <DialogContent className="border-bg-border bg-bg-card text-text-primary">
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-brand-cyan" />
              <p>Creating your account...</p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={state === "DONE"} onOpenChange={() => {}}>
        <DialogContent className="border-bg-border bg-bg-card text-center text-text-primary">
          <DialogHeader>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto mb-4"
            >
              <CheckCircle className="mx-auto h-16 w-16 text-status-green" />
            </motion.div>
            <DialogTitle className="text-xl">Welcome to LMSClasses! 🎓</DialogTitle>
          </DialogHeader>
          <p className="text-text-secondary">
            Your account has been created. We&apos;ve sent your login credentials to {doneEmail}.
          </p>
          <p className="font-mono text-sm">
            Your LMS ID:{" "}
            <span className="rounded bg-brand-cyan/20 px-2 py-1 text-brand-cyan">{doneLmsId}</span>
          </p>
          <p className="text-sm text-text-muted">
            Redirecting you to your courses in {countdown}...
          </p>
          <Button
            onClick={goToCourses}
            className="w-full bg-brand-cyan text-bg-base hover:bg-brand-cyan-light"
          >
            Go to My Courses Now →
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
