import type { Role } from "@/lib/domain/enums";
import type { DefaultSession } from "next-auth";

// Augment Auth.js types with our custom fields. Session/User live on
// `next-auth`; the JWT type is canonically `@auth/core/jwt` (next-auth/jwt
// just re-exports it), so the JWT augmentation must target that module.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      discordId: string | null;
      discordName: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    discordId?: string | null;
    discordName?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
    discordId?: string | null;
    discordName?: string | null;
  }
}
