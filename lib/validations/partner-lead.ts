import { z } from "zod";

export const externalLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(8, "Phone is required").max(20),
  course: z.string().min(1, "Course is required").max(200),
  source: z.string().max(120).optional(),
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
});

export const externalPaymentConfirmSchema = z.object({
  leadId: z.string().uuid("Valid leadId is required"),
  paymentId: z.string().min(1, "paymentId is required").max(120),
  amount: z.number().positive("amount must be positive"),
  currency: z.string().min(3).max(3).default("INR"),
  paymentGateway: z.string().min(1).max(60).default("razorpay"),
});

export type ExternalLeadInput = z.infer<typeof externalLeadSchema>;
export type ExternalPaymentConfirmInput = z.infer<typeof externalPaymentConfirmSchema>;
