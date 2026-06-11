import NextAuth from "next-auth";
import { createReconcilingAdapter } from "@/lib/auth-adapter";
import { authConfig } from "@/lib/auth.config";
import { characterRepository } from "@/lib/repositories/character-repository";
import { autoClaimFromSignups } from "@/lib/services/auto-claim";
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
  events: {
    // Auto-claim characters from the user's Raid-Helper signups on every login.
    // Idempotent (claimCharacter skips already-yours/owned-by-other), so re-runs
    // are harmless. Fire-and-forget: Auth.js swallows errors here, so a failure
    // can't block login — guarded with try/catch to log rather than vanish.
    // Claims land in the DB this request but only surface on the next page load.
    async signIn({ user, profile, account }) {
      const discordId = profile?.id ?? account?.providerAccountId;
      if (!user.id || !discordId) return;
      try {
        await autoClaimFromSignups(characterRepository, user.id, discordId);
      } catch (err) {
        console.error("[auth] auto-claim failed", err);
      }
    },
  },
});
