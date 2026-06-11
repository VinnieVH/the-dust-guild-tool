import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { Role } from "@/lib/domain/enums";
import type { db as Db } from "@/lib/db";

// The profile()-shaped object Auth.js passes to createUser. AdapterUser doesn't
// declare our custom fields, so we extend it (no `any`, no cast).
type CreateUserInput = Omit<AdapterUser, "id"> & {
  discordId: string;
  discordName: string;
  role: Role;
};

// Wrap the Prisma adapter so createUser reconciles with stub users created by
// the Raid-Helper sync. A guild member who signed up on Discord already has a
// row keyed by discordId (no linked account); the default adapter blindly
// inserts and hits the unique constraint. We upsert by discordId instead.
//
// CRITICAL: `update: {}` — never write `role` here. A seeded OFFICER signing in
// for the first time must keep their role; writing the profile (role: MEMBER)
// would silently downgrade them.
export function createReconcilingAdapter(prisma: typeof Db): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    createUser: (user) => {
      const data = user as CreateUserInput;
      return prisma.user.upsert({
        where: { discordId: data.discordId },
        update: {}, // row exists (stub or officer) → return as-is, preserve role
        create: {
          discordId: data.discordId,
          discordName: data.discordName,
          name: data.name,
          email: data.email,
          image: data.image,
          role: data.role,
        },
      }) as ReturnType<NonNullable<Adapter["createUser"]>>;
    },
  };
}
