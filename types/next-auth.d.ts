import type { Role, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: UserStatus;
      preferredName?: string | null;
      avatar?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    status: UserStatus;
    preferredName?: string | null;
    avatar?: string | null;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: UserStatus;
    preferredName?: string | null;
    avatar?: string | null;
    sv?: number;
  }
}
