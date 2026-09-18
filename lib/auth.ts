import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, hrUsers } from "@/lib/db/schema";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organisationId = user.organisationId;
        token.courseId = user.courseId;
        token.lmsId = user.lmsId;
        token.companyId = user.companyId;
        token.checkedAt = Date.now();
        return token;
      }

      const checkedAt = token.checkedAt ?? 0;
      if (Date.now() - checkedAt < 5 * 60 * 1000) return token;
      token.checkedAt = Date.now();

      if (!token.sub) return token;

      if (token.role === "hr") {
        const [hr] = await db
          .select({ isActive: hrUsers.isActive })
          .from(hrUsers)
          .where(eq(hrUsers.id, token.sub))
          .limit(1);
        if (!hr || hr.isActive === false) return null as unknown as typeof token;
        return token;
      }

      const [row] = await db
        .select({
          isActive: users.isActive,
          deletedAt: users.deletedAt,
          role: users.role,
          organisationId: users.organisationId,
          courseId: users.courseId,
        })
        .from(users)
        .where(eq(users.id, token.sub))
        .limit(1);
      if (!row || row.deletedAt || row.isActive === false) {
        return null as unknown as typeof token;
      }
      token.role = row.role;
      token.organisationId = row.organisationId;
      token.courseId = row.courseId;
      return token;
    },
  },
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
                courseId: user.courseId,
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
