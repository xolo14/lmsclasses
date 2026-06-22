import { AUTH_PAGE_INLINE_STYLES } from "@/lib/auth-page-styles";
import { AuthRecoveryNotice } from "@/components/auth/AuthRecoveryNotice";

/** Never cache HR auth pages — stale HTML breaks _next/static chunk URLs after deploy. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HrAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: AUTH_PAGE_INLINE_STYLES }} />
      <div data-auth-loader aria-live="polite">
        Loading sign-in…
      </div>
      <AuthRecoveryNotice />
      <div data-auth-content>{children}</div>
    </>
  );
}
