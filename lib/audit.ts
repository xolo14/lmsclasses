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

  // Fire-and-forget: do not await. Hostinger runs a long-lived Node process,
  // so the insert continues after the response without Vercel waitUntil.
  void promise;

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
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return undefined;
}
