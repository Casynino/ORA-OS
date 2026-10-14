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
      /** Set ONLY while a Developer is working as this person — the real Developer. */
      impersonatedBy?: { id: string; name: string } | null;
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
    devAt?: number; // Developer sessions only: sign-in time, for the 8h expiry
    /** Developer sessions only: the staff member currently being worked as. */
    actAs?: { id: string; role: Role; name: string; email: string };
  }
}
