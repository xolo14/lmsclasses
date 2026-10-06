import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { portalHomeForRole } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuthContinuePage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  redirect(portalHomeForRole(session.user.role));
}
