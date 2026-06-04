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

export async function logAction({
  userId,
  role,
  action,
  entity,
  entityId,
  metadata,
  ipAddress,
}: AuditLogInput) {
  await db.insert(auditLogs).values({
    userId,
    role,
    action,
    entity,
    entityId,
    metadata: metadata ?? {},
    ipAddress,
  });
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
