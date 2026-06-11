import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env.server";

// Prisma 7 uses driver adapters instead of a bundled query engine.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// Cache the client on globalThis in dev so Next.js hot-reload doesn't spawn a
// new pool on every change.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
