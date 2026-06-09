"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

interface BuySlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: { id: string; title: string; price: string };
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
    };
  }
}

export function BuySlotModal({ open, onOpenChange, course }: BuySlotModalProps) {
  const router = useRouter();
  const [slotsCount, setSlotsCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAssignPrompt, setShowAssignPrompt] = useState(false);

  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const unitPrice = parseFloat(course.price);
  const total = unitPrice * slotsCount;
  const finalTotal = Math.max(0, total - discount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    setCouponError("");
    setAppliedCoupon(null);
    setDiscount(0);

    try {
      const res = await fetch("/api/payments/redeem-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          slotsCount,
          couponCode: couponCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid coupon");
      }
      setAppliedCoupon(data.code);
      setDiscount(data.discountAmount);
    } catch (err: any) {
      setCouponError(err.message || "Failed to apply coupon");
    } finally {
      setCheckingCoupon(false);
    }
  };

  const completePurchase = async (paymentId: string, payload: Record<string, unknown>) => {
    const verifyRes = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, ...payload }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
      throw new Error(verifyData.error || "Payment verification failed");
    }
    onOpenChange(false);
    setShowAssignPrompt(true);
    router.refresh();
  };

  const handlePurchase = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          slotsCount,
          couponCode: appliedCoupon || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not start payment");
      }

      if (data.zeroAmount) {
        // Zero-amount checkout (coupon gave 100% discount)
        onOpenChange(false);
        setShowAssignPrompt(true);
        router.refresh();
        return;
      }


      if (!data.key || !data.orderId) {
        throw new Error("Invalid payment session. Please try again.");
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout failed to load. Refresh the page and try again.");
      }

      const options = {
        key: data.key,
        amount: Math.round(data.amount * 100),
        currency: data.currency,
        name: process.env.NEXT_PUBLIC_APP_NAME || "LMS Platform",
        description: `${slotsCount} slot(s) for ${course.title}`,
        order_id: data.orderId,
        theme: { color: "#06b6d4" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await completePurchase(data.paymentId, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed");
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setError(response.error?.description || "Payment failed. Please try again.");
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const resetModalState = () => {
    setSlotsCount(1);
    setCouponCode("");
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponError("");
    setError("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => {
        if (!val) resetModalState();
        onOpenChange(val);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy Slots — {course.title}</DialogTitle>
            <DialogDescription>
              Pay securely via Razorpay to purchase student enrollment slots.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Number of Slots</Label>
              <Input
                type="number"
                min={1}
                value={slotsCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setSlotsCount(val);
                  // Reset applied coupon when count changes to force re-validation
                  setAppliedCoupon(null);
                  setDiscount(0);
                  setCouponError("");
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Coupon Redeem</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g. SUMMER25"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || checkingCoupon || !couponCode.trim()}
                  onClick={handleApplyCoupon}
                >
                  {checkingCoupon ? "Checking..." : "Apply"}
                </Button>
              </div>
              {couponError && <p className="text-xs text-destructive">{couponError}</p>}
              {appliedCoupon && (
                <p className="text-xs text-emerald-500 font-medium">
                  Coupon &quot;{appliedCoupon}&quot; applied!
                </p>
              )}
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-1">
              <p className="text-sm text-muted-foreground">
                {formatCurrency(unitPrice)} × {slotsCount} slots = {formatCurrency(total)}
              </p>
              {discount > 0 && (
                <p className="text-sm text-emerald-500">
                  Discount: -{formatCurrency(discount)}
                </p>
              )}
              <p className="text-xl font-bold font-mono text-primary pt-2 border-t border-border mt-2">
                Final Total: {formatCurrency(finalTotal)}
              </p>
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handlePurchase} disabled={loading}>
              {loading ? "Processing..." : finalTotal === 0 ? "Fulfill for Free" : "Pay with Razorpay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignPrompt} onOpenChange={setShowAssignPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Successful!</DialogTitle>
            <DialogDescription>
              Your slots have been added. Would you like to assign students now?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignPrompt(false)}>Maybe Later</Button>
            <Button onClick={() => router.push("/org-admin/students")}>Assign Students</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
