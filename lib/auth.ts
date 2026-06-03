import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, hrUsers } from "@/lib/db/schema";
import type { Role } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required on Hostinger/Vercel-style hosts so Auth.js trusts the public domain.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (user && user.isActive) {
          const isValid = await bcrypt.compare(password, user.password);
          if (isValid) {
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
        if (!hr || !hr.isActive) return null;
        const isHrValid = await bcrypt.compare(password, hr.passwordHash);
        if (!isHrValid) return null;

        return {
          id: hr.id,
          name: hr.name,
          email: hr.email,
          role: hr.role,
          organisationId: null,
          lmsId: null,
          companyId: hr.companyId,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
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
});
