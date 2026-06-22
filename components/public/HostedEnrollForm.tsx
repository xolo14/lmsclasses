"use client";

import { useEffect, useState } from "react";
import { YEAR_OF_STUDY_OPTIONS } from "@/lib/validations/widget";

type EnrollConfig = {
  courseName: string;
  price: number;
  currency: string;
  razorpayKeyId?: string;
  orgName?: string;
  formConfig?: { yearOptions?: readonly string[] };
};

type HostedEnrollFormProps = {
  formSlug: string;
};

type RazorpayCtor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
};

function loadRazorpay(): Promise<RazorpayCtor> {
  return new Promise((resolve, reject) => {
    const win = window as Window & { Razorpay?: RazorpayCtor };
    if (win.Razorpay) {
      resolve(win.Razorpay);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      if (win.Razorpay) resolve(win.Razorpay);
      else reject(new Error("Razorpay failed to load"));
    };
    script.onerror = () => reject(new Error("Razorpay failed to load"));
    document.head.appendChild(script);
  });
}

export function HostedEnrollForm({ formSlug }: HostedEnrollFormProps) {
  const [config, setConfig] = useState<EnrollConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");

  useEffect(() => {
    fetch(`/api/enroll/${encodeURIComponent(formSlug)}/config`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof json.message === "string" ? json.message : "Unable to load form");
        }
        setConfig(json);
      })
      .catch((err: Error) => {
        setMessage(err.message || "Unable to load enrollment form.");
        setMessageType("error");
      })
      .finally(() => setLoading(false));
  }, [formSlug]);

  async function postJson<T>(url: string, payload: unknown): Promise<{ ok: boolean; json: T }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, json };
  }

  async function handleCallback(res: { ok: boolean; json: Record<string, unknown> }) {
    setSubmitting(false);
    if (res.json.success && typeof res.json.redirectUrl === "string") {
      setMessage((res.json.message as string) || "Enrollment confirmed!");
      setMessageType("success");
      window.setTimeout(() => {
        window.location.href = res.json.redirectUrl as string;
      }, 1200);
      return;
    }
    setMessage(
      (res.json.message as string) || "Payment didn't go through. We'll be in touch shortly."
    );
    setMessageType("error");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!config || submitting) return;

    const fd = new FormData(e.currentTarget);
    const payload = {
      fullName: String(fd.get("fullName") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      college: String(fd.get("college") || "").trim() || null,
      yearOfStudy: String(fd.get("yearOfStudy") || "") || null,
      degree: String(fd.get("degree") || "").trim() || null,
      landingPageUrl: window.location.href,
    };

    if (!payload.fullName || !payload.email || !payload.phone) {
      setMessage("Please fill in all required fields.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setMessageType("");

    try {
      const base = `/api/enroll/${encodeURIComponent(formSlug)}`;
      const res = await postJson<Record<string, unknown>>(`${base}/submit`, payload);

      if (res.json.alreadyEnrolled) {
        setSubmitting(false);
        setMessage((res.json.message as string) || "Already enrolled");
        setMessageType("error");
        return;
      }
      if (!res.ok) {
        throw new Error((res.json.message as string) || "Could not start enrollment");
      }

      const orderId = res.json.razorpayOrderId as string;
      const amount = res.json.amount as number;
      const leadId = res.json.leadId as string;
      const keyId = (res.json.razorpayKeyId as string) || config.razorpayKeyId;

      if (orderId.startsWith("order_test_")) {
        await handleCallback(
          await postJson(`${base}/payment-callback`, {
            leadId,
            razorpay_payment_id: `pay_test_${leadId.slice(0, 8)}`,
            razorpay_order_id: orderId,
            razorpay_signature: "test",
          })
        );
        return;
      }

      const Razorpay = await loadRazorpay();
      const rzp = new Razorpay({
        key: keyId,
        amount,
        currency: (res.json.currency as string) || "INR",
        name: "LMS Classes",
        description: (res.json.courseName as string) || config.courseName,
        order_id: orderId,
        prefill: { name: payload.fullName, email: payload.email, contact: payload.phone },
        theme: { color: "#FF0A18" },
        handler: async (response: Record<string, string>) => {
          await handleCallback(
            await postJson(`${base}/payment-callback`, {
              leadId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            })
          );
        },
        modal: {
          ondismiss: async () => {
            await handleCallback(
              await postJson(`${base}/payment-callback`, {
                leadId,
                razorpay_order_id: orderId,
                status: "cancelled",
                error_description: "User closed payment window",
              })
            );
          },
        },
      });

      rzp.on("payment.failed", async (resp) => {
        await handleCallback(
          await postJson(`${base}/payment-callback`, {
            leadId,
            razorpay_order_id: orderId,
            status: "failed",
            error_description: resp.error?.description || "Payment failed",
          })
        );
      });

      rzp.open();
    } catch (err) {
      setSubmitting(false);
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setMessageType("error");
    }
  }

  const yearOptions = config?.formConfig?.yearOptions ?? YEAR_OF_STUDY_OPTIONS;

  if (loading) {
    return (
      <div className="rounded-sm border border-swiss-black/10 bg-white p-10 text-center text-sm text-swiss-muted">
        Loading enrollment form…
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        {message || "This enrollment form is unavailable."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-sm border border-swiss-black/10 bg-white shadow-none">
      <div className="border-b-4 border-swiss-red bg-swiss-cream px-6 py-5 text-center">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-swiss-muted">
          Course enrollment
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-tight">{config.courseName}</h1>
        <p className="mt-1 text-sm text-swiss-muted">
          Secure checkout · ₹{config.price.toLocaleString("en-IN")}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 p-6">
        {message && (
          <p
            className={
              messageType === "success"
                ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
                : "rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            }
          >
            {message}
          </p>
        )}

        <Field label="Full Name" name="fullName" required placeholder="Your full name" />
        <Field label="Email" name="email" type="email" required placeholder="you@example.com" />
        <Field label="Phone" name="phone" type="tel" required placeholder="10-digit mobile" />
        <Field label="College" name="college" placeholder="College / university" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-swiss-muted">
              Year of Study
            </label>
            <select
              name="yearOfStudy"
              className="flex h-11 w-full rounded-sm border border-swiss-black/15 bg-white px-3 text-sm"
            >
              <option value="">Select year</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <Field label="Degree" name="degree" placeholder="B.Tech, MBA…" />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-sm bg-swiss-red text-sm font-bold uppercase tracking-[0.12em] text-white disabled:opacity-60"
        >
          {submitting
            ? "Processing…"
            : `Confirm Enrollment ₹${config.price.toLocaleString("en-IN")} →`}
        </button>

        <p className="text-center text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-swiss-muted">
          Limited seats · {config.orgName || "LMS Classes"}
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={name}
        className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-swiss-muted"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="flex h-11 w-full rounded-sm border border-swiss-black/15 bg-white px-3 text-sm"
      />
    </div>
  );
}
