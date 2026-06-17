/** Never cache auth pages — stale HTML breaks _next/static chunk URLs after deploy. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
