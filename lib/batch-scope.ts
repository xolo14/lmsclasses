import { eq, isNull, or, type SQL } from "drizzle-orm";
import { batches } from "@/lib/db/schema";

/** Batches visible to an org admin: their org's batches + platform-wide (super-admin) batches. */
export function orgAdminVisibleBatches(orgId: string): SQL {
  return or(eq(batches.organisationId, orgId), isNull(batches.organisationId))!;
}

/** True when batch was created for all organisations (super admin / manager, no org set). */
export function isPlatformWideBatch(organisationId: string | null | undefined): boolean {
  return organisationId == null;
}
