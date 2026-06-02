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
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function BuySlotModal({ open, onOpenChange, course }: BuySlotModalProps) {
  const router = useRouter();
  const [slotsCount, setSlotsCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showAssignPrompt, setShowAssignPrompt] = useState(false);

  const unitPrice = parseFloat(course.price);
  const total = unitPrice * slotsCount;

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, slotsCount }),
      });
      const data = await res.json();

      if (data.mock) {
        await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: data.paymentId, mock: true }),
        });
        onOpenChange(false);
        setShowAssignPrompt(true);
        return;
      }

      const options = {
        key: data.key,
        amount: data.amount * 100,
        currency: data.currency,
        name: "LMS Platform",
        description: `${slotsCount} slots for ${course.title}`,
        order_id: data.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId: data.paymentId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          onOpenChange(false);
          setShowAssignPrompt(true);
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy Slots — {course.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Number of Slots</Label>
              <Input
                type="number"
                min={1}
                value={slotsCount}
                onChange={(e) => setSlotsCount(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="rounded-lg bg-muted p-4 space-y-1">
              <p className="text-sm text-muted-foreground">
                {formatCurrency(unitPrice)} × {slotsCount} slots
              </p>
              <p className="text-xl font-bold font-mono text-primary">
                Total: {formatCurrency(total)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handlePurchase} disabled={loading}>
              {loading ? "Processing..." : "Pay with Razorpay"}
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
