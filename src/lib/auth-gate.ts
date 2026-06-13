import { Role } from "@/lib/domain/enums";

// Pure, testable gating decision used by proxy.ts. Keeping it free of Next/
// Auth.js types means the role logic can be unit-tested without a live session.
export const MEMBER_PREFIXES = ["/raids", "/leaderboard", "/guild", "/profile"];
export const OFFICER_PREFIXES = ["/admin", "/api/admin"];

export type GateDecision =
  | { kind: "allow" }
  | { kind: "unauthorized"; api: boolean }
  | { kind: "forbidden"; api: boolean };

export type SessionView = { role: Role } | null;

export function decideGate(pathname: string, session: SessionView): GateDecision {
  const needsOfficer = OFFICER_PREFIXES.some((p) => pathname.startsWith(p));
  const needsMember = MEMBER_PREFIXES.some((p) => pathname.startsWith(p));

  if (!needsOfficer && !needsMember) {
    return { kind: "allow" };
  }

  const api = pathname.startsWith("/api/");

  if (!session) {
    return { kind: "unauthorized", api };
  }

  if (needsOfficer && session.role !== Role.OFFICER) {
    return { kind: "forbidden", api };
  }

  return { kind: "allow" };
}
