import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    tenantId: string;
    tenantSlug: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string;
      tenantSlug: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string;
    tenantSlug: string;
  }
}
