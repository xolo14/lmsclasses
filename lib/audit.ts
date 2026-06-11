import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import type { Role } from "@/lib/db/schema";

export interface AuditLogInput {
  userId?: string;
  role?: Role;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export function logAction(input: AuditLogInput): Promise<void> {
  // PERF: Audit log writes are fire-and-forget — they do not need to block the response.
  // We perform the query asynchronously in the background and resolve immediately.
  const promise = db
    .insert(auditLogs)
    .values({
      userId: input.userId,
      role: input.role,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress,
    })
    .catch((err) => {
      console.error("[AUDIT LOG FAILED]", err);
    });

  // Attempt to use Vercel's waitUntil to keep serverless function execution context warm/alive, if available
  try {
    const { waitUntil } = require("@vercel/functions");
    waitUntil(promise);
  } catch {
    // Graceful fallback when not in Vercel environment
  }

  return Promise.resolve();
}

/** HR users live in hr_users — audit_logs.user_id only references users.id */
export function auditUserIdForSession(user: { id: string; role: Role }): string | undefined {
  return user.role === "hr" ? undefined : user.id;
}

export function auditMetadataForSession(
  user: { id: string; role: Role },
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  const base = metadata ?? {};
  if (user.role === "hr") {
    return { hrId: user.id, ...base };
  }
  return base;
}

export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}
