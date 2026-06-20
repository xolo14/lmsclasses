"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Script from "next/script";

type CheckoutData = {
  fullName: string;
  courseName: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
};

export function RepayCheckout({ leadId }: { leadId: string }) {
  const searchParams = useSearchParams();
  const sig = searchParams.get("sig") ?? "";
  const [data, setData] = useState<CheckoutData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!sig) {
      setError("Invalid payment link.");
      return;
    }
    fetch(`/api/public/repay/${leadId}?sig=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message || "Could not load payment session"));
  }, [leadId, sig]);

  const startPayment = async () => {
    if (!data || loading) return;
    setLoading(true);
    setError("");

    try {
      const Razorpay = (window as Window & { Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on?: (e: string, h: (r: unknown) => void) => void } }).Razorpay;
      if (!Razorpay) throw new Error("Payment gateway failed to load");

      if (data.razorpayOrderId.startsWith("order_test_")) {
        const res = await fetch(
          `/api/public/repay/${leadId}/confirm?sig=${encodeURIComponent(sig)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: `pay_test_${leadId.slice(0, 8)}`,
              razorpay_order_id: data.razorpayOrderId,
              razorpay_signature: "test",
            }),
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setDone(true);
        setTimeout(() => {
          window.location.href = json.loginUrl ?? "/login";
        }, 1500);
        return;
      }

      const rzp = new Razorpay({
        key: data.razorpayKeyId,
        amount: data.amount,
        currency: data.currency,
        name: "LMS Classes",
        description: data.courseName,
        order_id: data.razorpayOrderId,
        prefill: { name: data.fullName },
        theme: { color: "#E30613" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          const res = await fetch(
            `/api/public/repay/${leadId}/confirm?sig=${encodeURIComponent(sig)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            }
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          setDone(true);
          setTimeout(() => {
            window.location.href = json.loginUrl ?? "/login";
          }, 1500);
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full border-2 border-black bg-[#f5f3ef] p-8 text-center space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done ? (
            <p className="text-green-700 font-medium">Payment confirmed! Redirecting to login…</p>
          ) : data ? (
            <>
              <p className="text-xs uppercase tracking-widest text-neutral-500">Complete enrollment</p>
              <h1 className="text-xl font-bold">{data.courseName}</h1>
              <p className="text-neutral-600">Hi {data.fullName}, complete your payment to access the course.</p>
              <p className="text-2xl font-bold">₹{(data.amount / 100).toLocaleString("en-IN")}</p>
              <Button
                className="w-full bg-[#e8392f] hover:bg-[#d12e25] uppercase tracking-wider"
                onClick={startPayment}
                disabled={loading}
              >
                {loading ? "Processing…" : "Pay Now →"}
              </Button>
            </>
          ) : !error ? (
            <p className="text-neutral-500">Loading payment…</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
