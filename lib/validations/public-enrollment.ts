import { z } from "zod";

export const StudentRegistrationSchema = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z.string(),
    collegeName: z.string().min(2).max(200),
    city: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const PublicEnrollmentSchema = z.object({
  courseId: z.string().uuid(),
  paymentData: z.object({
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1),
  }),
  studentData: StudentRegistrationSchema,
});

export type StudentRegistrationInput = z.infer<typeof StudentRegistrationSchema>;
export type PublicEnrollmentInput = z.infer<typeof PublicEnrollmentSchema>;
