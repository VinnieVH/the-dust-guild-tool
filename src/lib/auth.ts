import NextAuth from "next-auth";
import { createReconcilingAdapter } from "@/lib/auth-adapter";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

// Full auth setup: adapter-free config + the Prisma adapter (Node-only `pg`).
// Next 16 proxy runs on the Node runtime, so importing this from the proxy is
// safe, but the proxy only reads the JWT (no DB hit) by design.
//
// The adapter reconciles first sign-in with stub users created by the
// Raid-Helper sync (see auth-adapter.ts).
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createReconcilingAdapter(db),
  ...authConfig,
});
