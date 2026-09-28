import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { Role } from "@/lib/db/schema";
import { portalHomeForRole } from "@/lib/utils";

/** Missing session → public home (never /login or /api/logout — those bounced or 500'd). Wrong role → that role's home. */
export function requirePortalSession(
  session: Session | null,
  role: Role
): asserts session is Session & { user: NonNullable<Session["user"]> } {
  if (!session?.user) {
    redirect("/");
  }
  if (session.user.role !== role) {
    redirect(portalHomeForRole(session.user.role));
  }
}
