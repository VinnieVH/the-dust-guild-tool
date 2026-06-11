import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import { Role } from "@/lib/domain/enums";
import { env } from "@/lib/env.server";

// Adapter-free config: providers + callbacks only. Safe to import anywhere
// (no `pg`/Prisma), and kept separate from auth.ts so the proxy can reason
// about sessions without pulling in the database driver.
//
// Session uses the JWT strategy: role/discordId live in the token, so the
// proxy can do cookie-only optimistic checks with no DB hit. Note: because the
// role is baked into the JWT at sign-in, promoting a member to OFFICER (via
// seed) only takes effect after that user signs in again.
export const authConfig = {
  session: { strategy: "jwt" },
  providers: [
    Discord({
      // Read credentials from our validated env explicitly. Auth.js's
      // auto-discovery only looks for AUTH_DISCORD_ID/SECRET; we use the
      // *_CLIENT_* names, so they must be wired in by hand.
      clientId: env.AUTH_DISCORD_CLIENT_ID,
      clientSecret: env.AUTH_DISCORD_CLIENT_SECRET,
      // Map the Discord profile into our User shape. The Prisma adapter
      // spreads this object straight into user.create on first sign-in, so
      // discordId/discordName (both NOT NULL) must be present here.
      profile(profile) {
        return {
          id: profile.id,
          discordId: profile.id,
          discordName: profile.global_name ?? profile.username,
          name: profile.global_name ?? profile.username,
          email: profile.email ?? null,
          image: profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null,
          role: Role.MEMBER,
        };
      },
    }),
  ],
  callbacks: {
    // Persist identity + role onto the JWT. On first sign-in `user` is the
    // freshly-created row; afterwards we read the role back from the DB-synced
    // token. `db` is injected from auth.ts to keep this file adapter-free.
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? Role.MEMBER;
        token.discordId = user.discordId ?? null;
        token.discordName = user.discordName ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id;
        session.user.role = token.role ?? Role.MEMBER;
        session.user.discordId = token.discordId ?? null;
        session.user.discordName = token.discordName ?? null;
      }
      return session;
    },
  },
  pages: {},
} satisfies NextAuthConfig;
