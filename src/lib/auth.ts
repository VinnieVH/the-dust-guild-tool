import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

// Full auth setup: adapter-free config + the Prisma adapter (Node-only `pg`).
// Next 16 proxy runs on the Node runtime, so importing this from the proxy is
// safe, but the proxy only reads the JWT (no DB hit) by design.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  ...authConfig,
});
