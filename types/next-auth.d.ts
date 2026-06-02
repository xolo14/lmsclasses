import type { Role } from "@/lib/db/schema";
declare module "next-auth" {
  interface User {
    role: Role;
    organisationId?: string | null;
    lmsId?: string | null;
    companyId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      organisationId?: string | null;
      lmsId?: string | null;
      companyId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    organisationId?: string | null;
    lmsId?: string | null;
    companyId?: string | null;
  }
}
