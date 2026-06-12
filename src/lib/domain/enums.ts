// Domain enums mirroring the Prisma schema enums. Services and components use
// THESE, never the Prisma-generated enums — keeps the persistence layer from
// leaking upward (see implementation-plan §Cross-cutting #3).

export const Role = {
  MEMBER: "MEMBER",
  OFFICER: "OFFICER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const MainRole = {
  TANK: "TANK",
  HEALER: "HEALER",
  DPS: "DPS",
} as const;
export type MainRole = (typeof MainRole)[keyof typeof MainRole];

// NOTE: the SSC|TK `Instance` enum was removed in the WCL-zone-flexible change
// (Phase 4). softres sheets are officer-named strings (Step 3.3), and a
// WclReport now stores the WCL zone *name* as a free string so any TBC
// instance (Kara, Gruul, Mag, …) ingests cleanly. There is no fixed zone enum.
