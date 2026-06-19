import { z } from "zod";
import { API_PERMISSIONS } from "@/lib/api-key-service";

export const createApiKeySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  permissions: z
    .array(z.enum(API_PERMISSIONS))
    .min(1, "Select at least one permission"),
  expiresAt: z.string().optional().nullable(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
