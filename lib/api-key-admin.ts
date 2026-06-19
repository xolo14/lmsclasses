import type { ApiKey } from "@/lib/db/schema";
import { maskFromPrefix } from "@/lib/api-key-service";

export function serializeApiKey(k: ApiKey, includeSecrets = false) {
  return {
    id: k.id,
    name: k.name,
    maskedKey: maskFromPrefix(k.keyPrefix, k.environment ?? "live"),
    keyPrefix: k.keyPrefix,
    permissions: k.permissions ?? [],
    allowedCourses: k.allowedCourses ?? [],
    allowedPaymentGateway: k.allowedPaymentGateway,
    webhookUrl: k.webhookUrl,
    webhookSecret: includeSecrets ? k.webhookSecret : k.webhookSecret ? "••••••••" : null,
    leadFields: k.leadFields,
    autoCreateStudent: k.autoCreateStudent,
    sendWelcomeEmail: k.sendWelcomeEmail,
    notifyWebhook: k.notifyWebhook,
    rateLimit: k.rateLimit,
    ipWhitelist: k.ipWhitelist ?? [],
    environment: k.environment,
    isActive: k.isActive,
    lastUsedAt: k.lastUsedAt,
    usageCount: k.usageCount,
    notes: k.notes,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
}
