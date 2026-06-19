import { z } from "zod";

export const externalPaymentConfirmSchema = z.object({
  leadId: z.string().uuid(),
  razorpayPaymentId: z.string().min(1).optional(),
  razorpayOrderId: z.string().min(1).optional(),
  razorpaySignature: z.string().min(1).optional(),
  paymentId: z.string().min(1).optional(),
  amount: z.number().int().positive(),
  currency: z.string().length(3).default("INR"),
  paymentGateway: z.string().optional().default("razorpay"),
});

export const externalPaymentVerifySchema = z.object({
  leadId: z.string().uuid(),
});

export const externalResendCredentialsSchema = z.object({
  leadId: z.string().uuid(),
});
