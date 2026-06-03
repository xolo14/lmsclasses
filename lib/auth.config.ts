import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/db/schema";

const authBaseUrl =
  process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";

/** Secure cookies only when AUTH_URL/NEXTAUTH_URL uses https. */
export const useSecureCookies = authBaseUrl
  ? authBaseUrl.startsWith("https://")
  : false;

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
