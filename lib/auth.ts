import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, hrUsers } from "@/lib/db/schema";
import { authConfig } from "@/lib/auth.config";

function googleLoginCredentials() {
  const clientId = process.env.AUTH_GOOGLE_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function findActiveLmsUserByEmail(email: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      organisationId: users.organisationId,
      courseId: users.courseId,
      lmsId: users.lmsId,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  if (!row || row.isActive === false || row.role === "hr") return null;
  return row;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const email = typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified !== false;
      if (!email || !verified) return "/login?error=GoogleNotRegistered";
      const row = await findActiveLmsUserByEmail(email);
      if (!row) return "/login?error=GoogleNotRegistered";
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        const email = user?.email?.trim().toLowerCase();
        if (!email) return null as unknown as typeof token;
        const row = await findActiveLmsUserByEmail(email);
        if (!row) return null as unknown as typeof token;
        token.sub = row.id;
        token.role = row.role;
        token.organisationId = row.organisationId;
        token.courseId = row.courseId;
        token.lmsId = row.lmsId;
        token.companyId = null;
        token.checkedAt = Date.now();
        return token;
      }

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
    ...(() => {
      const google = googleLoginCredentials();
      return google
        ? [
            Google({
              clientId: google.clientId,
              clientSecret: google.clientSecret,
              allowDangerousEmailAccountLinking: true,
            }),
          ]
        : [];
    })(),
  ],
});
