import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, hrUsers } from "@/lib/db/schema";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          if (!authConfig.secret) {
            console.error("[auth] AUTH_SECRET / NEXTAUTH_SECRET is not set");
            return null;
          }

          const email = (credentials.email as string).trim().toLowerCase();
          const password = credentials.password as string;

          // Per-account lockout (complements IP limit on the auth route)
          const { peekRateLimit, recordRateLimitHit, clearRateLimit } = await import(
            "@/lib/rate-limit"
          );
          const accountLimit = peekRateLimit(`login:email:${email}`, 8, 15 * 60 * 1000);
          if (!accountLimit.allowed) {
            return null;
          }

          const [user] = await db
            .select()
            .from(users)
            .where(and(eq(users.email, email), isNull(users.deletedAt)))
            .limit(1);

          if (user && user.isActive !== false) {
            const hash = user.password.trim();
            if (!hash.startsWith("$2")) {
              recordRateLimitHit(`login:email:${email}`, 15 * 60 * 1000);
              return null;
            }
            const isValid = await bcrypt.compare(password, hash);
            if (isValid) {
              clearRateLimit(`login:email:${email}`);
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                organisationId: user.organisationId,
                lmsId: user.lmsId,
                companyId: null,
              };
            }
          }

          const [hr] = await db
            .select()
            .from(hrUsers)
            .where(eq(hrUsers.email, email))
            .limit(1);
          if (hr && hr.isActive !== false) {
            const hrHash = hr.passwordHash.trim();
            const isHrValid = await bcrypt.compare(password, hrHash);
            if (isHrValid) {
              clearRateLimit(`login:email:${email}`);
              return {
                id: hr.id,
                name: hr.name,
                email: hr.email,
                role: hr.role,
                organisationId: null,
                lmsId: null,
                companyId: hr.companyId,
              };
            }
          }

          recordRateLimitHit(`login:email:${email}`, 15 * 60 * 1000);
          return null;
        } catch (err) {
          console.error("[auth] authorize failed:", err);
          return null;
        }
      },
    }),
  ],
});
