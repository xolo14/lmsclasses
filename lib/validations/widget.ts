import { z } from "zod";

export const YEAR_OF_STUDY_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "Graduated",
] as const;

const indianPhone = z
  .string()
  .min(10)
  .max(15)
  .refine((phone) => {
    const digits = phone.replace(/\D/g, "");
    const normalized =
      digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    return /^[6-9]\d{9}$/.test(normalized);
  }, "Must be a valid 10-digit Indian mobile number");

function sanitizeText(value: string, max: number): string {
  return value.trim().replace(/[<>]/g, "").slice(0, max);
}

export const widgetSubmitSchema = z.object({
  key: z.string().min(1),
  fullName: z
    .string()
    .min(2, "Full name is required")
    .max(120)
    .transform((s) => sanitizeText(s, 120)),
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  phone: indianPhone,
  college: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? sanitizeText(v, 200) : null)),
  yearOfStudy: z.enum(YEAR_OF_STUDY_OPTIONS).optional().nullable(),
  degree: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v ? sanitizeText(v, 120) : null)),
  landingPageUrl: z.string().url().optional().nullable(),
});

export const widgetPaymentCallbackSchema = z.object({
  key: z.string().min(1),
  leadId: z.string().uuid(),
  razorpay_payment_id: z.string().min(1).optional(),
  razorpay_order_id: z.string().min(1).optional(),
  razorpay_signature: z.string().min(1).optional(),
  status: z.enum(["failed", "cancelled"]).optional(),
  error_description: z.string().max(500).optional().nullable(),
});

export type WidgetSubmitInput = z.infer<typeof widgetSubmitSchema>;
export type WidgetPaymentCallbackInput = z.infer<typeof widgetPaymentCallbackSchema>;
