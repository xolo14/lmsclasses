import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/db/schema";

/** Hostinger hPanel Environment variables → process.env (no .env file required). */
function authSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    undefined
  );
}

const authBaseUrl =
  process.env.AUTH_URL?.trim() ||
  process.env.NEXTAUTH_URL?.trim() ||
  "";

/** Secure cookies only when AUTH_URL/NEXTAUTH_URL uses https. */
export const useSecureCookies = authBaseUrl
  ? authBaseUrl.startsWith("https://")
  : process.env.NODE_ENV === "production";

/** Writable secret — NextAuth assigns this; getter-only crashed middleware (500/503). */
let configuredSecret: string | undefined;

export const authConfig = {
  trustHost: true,
  get secret() {
    return configuredSecret ?? authSecret();
  },
  set secret(value: string | undefined) {
    configuredSecret = value?.trim() || undefined;
  },
  useSecureCookies,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organisationId = user.organisationId;
        token.lmsId = user.lmsId;
        token.companyId = user.companyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.organisationId = token.organisationId as string | null;
        session.user.lmsId = token.lmsId as string | null;
        session.user.companyId = token.companyId as string | null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
